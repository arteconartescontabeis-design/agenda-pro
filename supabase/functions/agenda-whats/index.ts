// Agenda Pro — envio dos avisos de WhatsApp
// Projeto Supabase do Agenda (vuwgxndahrzinfdlapxz).
//
// A cada chamada (pg_cron a cada 2 min, ou o app logo após salvar):
//   1. gera os lembretes que venceram (agenda_whats_gerar_lembretes);
//   2. reserva os avisos pendentes (agenda_whats_reservar), monta o texto e
//      coloca na fila do WhatsApp do Cobrança Pro (cob_agenda_enfileirar);
//   3. confere na fila do Cobrança o que já foi enviado (cob_agenda_status).
// Pode ser chamada várias vezes: a reserva impede envio em dobro.
import { createClient } from "jsr:@supabase/supabase-js@2";

const TZ = "America/Sao_Paulo";
const COB_URL = "https://yeujqjtjqtegsnzwwazb.supabase.co";
// chave pública (anon) do projeto do Cobrança; a fila só aceita com o token do cofre
const COB_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlldWpxanRqcXRlZ3Nuend3YXpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1NDE0OTksImV4cCI6MjEwMTExNzQ5OX0.5p1_wJ_aApJpRrN6tFu8qmAytK5FMXWt1soCubpzqao";
const MAX_TENTATIVAS = 3;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

type Aviso = {
  id: number;
  tenant_id: number;
  agendamento_id: number | null;
  tipo: string;
  telefone: string;
  tentativas: number;
};

const fmtDia = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "long", day: "2-digit", month: "2-digit" });
const fmtHora = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const fmtISO = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

const diaSP = (d: Date) => fmtISO.format(d); // AAAA-MM-DD no fuso de São Paulo
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function quando(d: Date) {
  const hoje = new Date();
  const amanha = new Date(hoje.getTime() + 86400000);
  const rel = diaSP(d) === diaSP(hoje) ? "hoje" : diaSP(d) === diaSP(amanha) ? "amanhã" : "";
  return { dia: capital(fmtDia.format(d)), hora: fmtHora.format(d), rel };
}

function fone(whatsapp?: string | null, telefone?: string | null): string | null {
  const limpa = (v?: string | null) => {
    let d = String(v || "").replace(/\D/g, "");
    if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
    return d;
  };
  const w = limpa(whatsapp), t = limpa(telefone);
  if (w.length === 10 || w.length === 11) return w;
  if (t.length === 11 && t[2] === "9") return t;
  return null;
}

type Dados = { nome: string; escritorio: string; servico: string; responsavel: string; inicio: Date };

function montarTexto(tipo: string, x: Dados): string {
  const q = quando(x.inicio);
  const det = [
    `📅 ${q.dia}`,
    `🕐 ${q.hora}`,
    x.servico ? `📋 ${x.servico}` : "",
    x.responsavel ? `👤 ${x.responsavel}` : "",
  ].filter(Boolean).join("\n");
  const ola = x.nome ? `Olá, ${x.nome}!` : "Olá!";
  switch (tipo) {
    case "confirmacao":
      return `${ola} ✅\nSeu atendimento com a *${x.escritorio}* está confirmado.\n\n${det}\n\nSe precisar remarcar ou cancelar, fale com a nossa equipe.`;
    case "lembrete_24h":
      return `${ola} 🔔\nLembrete: ${q.rel ? q.rel + " você tem" : "você tem"} atendimento com a *${x.escritorio}*.\n\n${det}\n\nSe não puder comparecer, avise a nossa equipe.`;
    case "lembrete_dia":
      return `${ola} 🔔\nHoje é dia do seu atendimento com a *${x.escritorio}*.\n\n${det}\n\nAté logo!`;
    case "reagendamento":
      return `${ola} 📅\nSeu atendimento com a *${x.escritorio}* foi *remarcado*. Nova data:\n\n${det}\n\nSe o novo horário não servir, fale com a nossa equipe.`;
    case "cancelamento":
      return `${ola}\nSeu atendimento com a *${x.escritorio}* de ${q.dia.toLowerCase()} às ${q.hora} foi *cancelado*.\n\nPara marcar uma nova data, fale com a nossa equipe.`;
    default:
      return "";
  }
}

async function cobRpc(fn: string, body: unknown) {
  const r = await fetch(`${COB_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: COB_ANON, Authorization: `Bearer ${COB_ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  let json: unknown = null;
  try { json = txt ? JSON.parse(txt) : null; } catch { /* texto puro */ }
  if (!r.ok) {
    const msg = (json && typeof json === "object" && "message" in json) ? String((json as { message: string }).message) : txt;
    throw new Error(msg || `HTTP ${r.status}`);
  }
  return json;
}

const cfgCache = new Map<number, Record<string, string>>();
async function config(tenant: number) {
  if (!cfgCache.has(tenant)) {
    const [{ data: cfg }, { data: ten }] = await Promise.all([
      db.from("agenda_config").select("chave, valor").eq("tenant_id", tenant),
      db.from("agenda_tenants").select("nome").eq("id", tenant).maybeSingle(),
    ]);
    const m: Record<string, string> = {};
    (cfg || []).forEach((c: { chave: string; valor: string }) => (m[c.chave] = c.valor));
    m.__escritorio = m.nome_escritorio || ten?.nome || "nosso escritório";
    cfgCache.set(tenant, m);
  }
  return cfgCache.get(tenant)!;
}

async function marcar(id: number, patch: Record<string, unknown>) {
  await db.from("agenda_whats_avisos").update({ ...patch, atualizado_em: new Date().toISOString() }).eq("id", id);
}

// Prepara um aviso: devolve texto, telefone e validade, ou o motivo para não enviar.
async function preparar(a: Aviso): Promise<{ texto: string; tel: string; valido?: string } | { motivo: string }> {
  const cfg = await config(a.tenant_id);
  if (a.tipo === "teste") {
    return {
      tel: a.telefone,
      texto: `✅ Teste do Agenda Pro — *${cfg.__escritorio}*.\nSe você recebeu esta mensagem, os avisos por WhatsApp da agenda estão funcionando.`,
    };
  }
  if ((cfg["whats_" + a.tipo] || "false") !== "true") return { motivo: "aviso desligado nas Configurações" };
  const { data: ag } = await db.from("agenda_agendamentos")
    .select("id, status, data_inicio, cliente_id, servico_id, usuario_responsavel_id")
    .eq("id", a.agendamento_id!).maybeSingle();
  if (!ag) return { motivo: "agendamento não existe mais" };
  const inicio = new Date(ag.data_inicio);
  if (inicio.getTime() <= Date.now()) return { motivo: "o horário do agendamento já passou" };
  const cancelado = ["cancelado_cliente", "cancelado_escritorio"].includes(ag.status);
  if (a.tipo === "cancelamento" ? !cancelado : ag.status !== "confirmado") {
    return { motivo: "a situação do agendamento mudou" };
  }
  const [{ data: cli }, { data: sv }, { data: us }] = await Promise.all([
    db.from("agenda_clientes").select("nome, whatsapp, telefone, whatsapp_avisos").eq("id", ag.cliente_id).maybeSingle(),
    ag.servico_id ? db.from("agenda_servicos").select("nome").eq("id", ag.servico_id).maybeSingle() : Promise.resolve({ data: null }),
    ag.usuario_responsavel_id ? db.from("agenda_usuarios").select("nome").eq("id", ag.usuario_responsavel_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!cli) return { motivo: "cliente não encontrado" };
  if (cli.whatsapp_avisos === false) return { motivo: "cliente não quer avisos por WhatsApp" };
  const tel = fone(cli.whatsapp, cli.telefone);
  if (!tel) return { motivo: "cliente sem WhatsApp cadastrado" };
  const servico = sv?.nome && !/sem servi/i.test(sv.nome) ? sv.nome : "";
  const texto = montarTexto(a.tipo, {
    nome: String(cli.nome || "").trim(),
    escritorio: cfg.__escritorio,
    servico,
    responsavel: String(us?.nome || "").trim(),
    inicio,
  });
  // aviso que não saiu até o horário do atendimento perde o sentido
  return { texto, tel, valido: a.tipo === "cancelamento" ? undefined : inicio.toISOString() };
}

async function enviarPendentes(token: string) {
  const { data: lote, error } = await db.rpc("agenda_whats_reservar", { p_limite: 20 });
  if (error) throw new Error("reservar: " + error.message);
  let naFila = 0, falhas = 0, descartados = 0;
  for (const a of (lote || []) as Aviso[]) {
    try {
      const p = await preparar(a);
      if ("motivo" in p) { await marcar(a.id, { status: "cancelado", erro: p.motivo }); descartados++; continue; }
      const filaId = await cobRpc("cob_agenda_enfileirar", {
        p_token: token,
        p_telefone: p.tel,
        p_mensagem: p.texto,
        p_valido_ate: p.valido ?? null,
        p_contexto: { tipo: a.tipo, agendamento_id: a.agendamento_id, aviso_id: a.id },
      });
      await marcar(a.id, { status: "na_fila", fila_id: filaId, mensagem: p.texto, telefone: p.tel, erro: null });
      naFila++;
    } catch (e) {
      const msg = String((e as Error).message || e).slice(0, 300);
      const fim = a.tentativas >= MAX_TENTATIVAS || /token|telefone inválido|limite/i.test(msg);
      await marcar(a.id, { status: fim ? "falha" : "pendente", erro: msg });
      falhas++;
    }
  }
  return { reservados: (lote || []).length, naFila, falhas, descartados };
}

async function conferirFila(token: string) {
  const { data: abertos } = await db.from("agenda_whats_avisos")
    .select("id, fila_id").eq("status", "na_fila").not("fila_id", "is", null).order("id").limit(200);
  if (!abertos || !abertos.length) return 0;
  const linhas = await cobRpc("cob_agenda_status", { p_token: token, p_ids: abertos.map((x) => x.fila_id) }) as
    { id: number; status: string; erro: string | null; enviado_em: string | null }[];
  const porFila = new Map((linhas || []).map((l) => [Number(l.id), l]));
  let n = 0;
  for (const a of abertos) {
    const f = porFila.get(Number(a.fila_id));
    if (!f || f.status === "pendente" || f.status === "enviando") continue;
    if (f.status === "enviado") await marcar(a.id, { status: "enviado", enviado_em: f.enviado_em || new Date().toISOString(), erro: null });
    else if (f.status === "expirado") await marcar(a.id, { status: "falha", erro: "não foi enviado a tempo (serviço de WhatsApp parado?)" });
    else if (f.status === "cancelado") await marcar(a.id, { status: "falha", erro: f.erro || "cancelada na fila do Cobrança" });
    else await marcar(a.id, { status: "falha", erro: f.erro || f.status });
    n++;
  }
  return n;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const resp = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
  try {
    const { data: token, error: eTok } = await db.rpc("agenda_whats_token");
    if (eTok || !token) return resp({ ok: false, erro: "token da fila não configurado" }, 500);
    const { data: gerados, error: eGer } = await db.rpc("agenda_whats_gerar_lembretes");
    if (eGer) console.error("gerar_lembretes:", eGer.message);
    const envio = await enviarPendentes(token as string);
    let conferidos = 0;
    try { conferidos = await conferirFila(token as string); } catch (e) { console.error("conferir:", (e as Error).message); }
    return resp({ ok: true, lembretes: gerados ?? 0, ...envio, conferidos });
  } catch (e) {
    console.error(e);
    return resp({ ok: false, erro: String((e as Error).message || e) }, 500);
  }
});
