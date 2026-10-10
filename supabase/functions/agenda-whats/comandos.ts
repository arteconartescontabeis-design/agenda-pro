// Agenda Pro — interpretação dos comandos recebidos por WhatsApp (equipe).
// Sem dependências: as funções aqui só leem texto e listas e devolvem o que
// fazer. Quem grava no banco e responde é o index.ts.
//
// Exemplos aceitos:
//   agendar Maria Souza amanhã 10h reunião contábil
//   marcar João dia 15 às 14:30 obs trazer documentos
//   agenda hoje · agenda amanhã · agenda 20/10
//   cancelar · ajuda

export type Cliente = { id: number; nome: string };
export type Servico = { id: number; nome: string; duracao_min: number };
export type Hoje = { ano: number; mes: number; dia: number; hora: number; minuto: number; dow: number }; // horário de São Paulo

export type Comando =
  | { acao: "ajuda" }
  | { acao: "cancelar" }
  | { acao: "listar"; data: string }
  | { acao: "agendar"; data: string | null; hora: string | null; duracao: number | null;
      cliente: Cliente | null; clienteNovo: string | null; ambiguos: Cliente[];
      servico: Servico | null; obs: string | null }
  | { acao: "desconhecido" };

export const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const DIAS: Record<string, number> = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };
const LIGACOES = new Set(["com", "para", "pra", "o", "a", "os", "as", "do", "da", "de", "dos", "das", "no", "na",
  "em", "um", "uma", "e", "cliente", "sr", "sra", "dr", "dra", "atendimento", "horario", "hora", "horas", "dia"]);

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (a: number, m: number, d: number) => `${a}-${pad(m)}-${pad(d)}`;

function somarDias(h: Hoje, n: number) {
  const d = new Date(Date.UTC(h.ano, h.mes - 1, h.dia + n));
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

// Texto quebrado em palavras (original e normalizada), para marcar o que já foi usado.
class Palavras {
  orig: string[]; norm: string[]; usada: boolean[];
  constructor(texto: string) {
    this.orig = texto.split(/\s+/).map((w) => w.replace(/^[,.;!?()"']+|[,.;!?()"']+$/g, "")).filter(Boolean);
    this.norm = this.orig.map(normalizar);
    this.usada = this.orig.map(() => false);
  }
  // procura a regex nas palavras ainda livres; marca as palavras do trecho encontrado
  pegar(re: RegExp): RegExpMatchArray | null {
    const livres = this.norm.map((w, i) => (this.usada[i] ? "\u0000" : w));
    const junto = livres.join(" ");
    const m = junto.match(re);
    if (!m || m.index === undefined) return null;
    const ini = junto.slice(0, m.index + (m[0].startsWith(" ") ? 1 : 0)).split(" ").length - 1;
    const fim = junto.slice(0, m.index + m[0].length).split(" ").length - 1;
    for (let i = ini; i <= fim; i++) this.usada[i] = true;
    return m;
  }
  restoOrig(ateIndice = this.orig.length) {
    return this.orig.filter((_, i) => i < ateIndice && !this.usada[i]);
  }
}

function lerData(p: Palavras, h: Hoje): string | null {
  if (p.pegar(/(?:^| )depois de amanha(?= |$)/)) return somarDias(h, 2);
  if (p.pegar(/(?:^| )amanha(?= |$)/)) return somarDias(h, 1);
  if (p.pegar(/(?:^| )hoje(?= |$)/)) return somarDias(h, 0);
  let m = p.pegar(/(?:^| )(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?(?= |$)/);
  if (m) {
    const d = +m[1], mes = +m[2];
    let ano = m[3] ? +m[3] : h.ano;
    if (ano < 100) ano += 2000;
    if (mes < 1 || mes > 12 || d < 1 || d > 31) return null;
    let alvo = iso(ano, mes, d);
    if (!m[3] && alvo < iso(h.ano, h.mes, h.dia)) alvo = iso(ano + 1, mes, d);
    return alvo;
  }
  m = p.pegar(/(?:^| )(?:na |no |nesta |neste |proxima |proximo )?(segunda|terca|quarta|quinta|sexta|sabado|domingo)(?:[- ]feira)?(?= |$)/);
  if (m) {
    let n = (DIAS[m[1]] - h.dow + 7) % 7;
    if (n === 0) n = 7;
    return somarDias(h, n);
  }
  m = p.pegar(/(?:^| )dia (\d{1,2})(?= |$)/);
  if (m) {
    const d = +m[1];
    if (d < 1 || d > 31) return null;
    let ano = h.ano, mes = h.mes;
    if (d < h.dia) { mes++; if (mes > 12) { mes = 1; ano++; } }
    return iso(ano, mes, d);
  }
  return null;
}

function lerHora(p: Palavras): string | null {
  let hh: number | null = null, mm = 0;
  let m = p.pegar(/(?:^| )(?:as |a )?(\d{1,2}) ?(?:h|hs|horas?)? e meia(?= |$)/);
  if (m) { hh = +m[1]; mm = 30; }
  if (hh === null && p.pegar(/(?:^| )(?:ao |as |a )?meio[- ]?dia(?= |$)/)) hh = 12;
  if (hh === null) {
    m = p.pegar(/(?:^| )(?:as |a )?(\d{1,2})(?::|h)(\d{2})(?:h|hs)?(?= |$)/);
    if (m) { hh = +m[1]; mm = +m[2]; }
  }
  if (hh === null) {
    m = p.pegar(/(?:^| )(?:as |a )?(\d{1,2}) ?(?:h|hs|hrs|horas?)(?= |$)/);
    if (m) hh = +m[1];
  }
  if (hh === null) {
    m = p.pegar(/(?:^| )as (\d{1,2})(?= |$)/);
    if (m) hh = +m[1];
  }
  if (hh === null) return null;
  if (p.pegar(/(?:^| )(?:da|de|a) (?:tarde|noite)(?= |$)/) && hh < 12) hh += 12;
  else p.pegar(/(?:^| )(?:da|de) manha(?= |$)/);
  if (hh > 23 || mm > 59) return null;
  return `${pad(hh)}:${pad(mm)}`;
}

function lerDuracao(p: Palavras): number | null {
  const m = p.pegar(/(?:^| )(?:por |de |com )?(\d{1,3}) ?(?:min|mins|minutos?)(?= |$)/);
  return m ? Math.max(5, Math.min(600, +m[1])) : null;
}

function acharServico(p: Palavras, servicos: Servico[]): Servico | null {
  const livres = p.norm.map((w, i) => (p.usada[i] ? "" : w)).join(" ");
  let melhor: Servico | null = null, tam = 0;
  for (const s of servicos) {
    const n = normalizar(s.nome);
    if (!n || /sem servi/.test(n)) continue;
    const re = new RegExp(`(?:^| )${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?= |$)`);
    if (re.test(livres) && n.length > tam) { melhor = s; tam = n.length; }
  }
  if (melhor) {
    const n = normalizar(melhor.nome).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    p.pegar(new RegExp(`(?:^| )${n}(?= |$)`));
  }
  return melhor;
}

function acharCliente(nomeDigitado: string, clientes: Cliente[]) {
  const alvo = normalizar(nomeDigitado).split(" ").filter((w) => w.length >= 2);
  if (!alvo.length) return { cliente: null, ambiguos: [] as Cliente[] };
  const exato = clientes.filter((c) => normalizar(c.nome) === alvo.join(" "));
  if (exato.length === 1) return { cliente: exato[0], ambiguos: [] };
  const achados = clientes.filter((c) => {
    const ws = normalizar(c.nome).split(/\s+/);
    return alvo.every((a) => ws.some((w) => w.startsWith(a)));
  });
  if (achados.length === 1) return { cliente: achados[0], ambiguos: [] };
  return { cliente: null, ambiguos: achados.slice(0, 5) };
}

const titulo = (s: string) =>
  s === s.toLowerCase() ? s.replace(/(^|\s)(\S)/g, (_, a, b) => a + b.toUpperCase()) : s;

export function interpretar(texto: string, h: Hoje, clientes: Cliente[], servicos: Servico[]): Comando {
  const t = normalizar(texto);
  if (!t) return { acao: "desconhecido" };
  if (/^(ajuda|menu|help|comandos|\?|oi|ola)\b/.test(t)) return { acao: "ajuda" };
  if (/^(cancelar|cancela|desfazer|desfaz)\b/.test(t)) return { acao: "cancelar" };

  const p = new Palavras(texto);
  const ehLista = /^(minha agenda|agenda|compromissos)\b/.test(t);
  const ehAgendar = /^(agendar|agende|agenda|marcar|marque|reuniao|nova reuniao)\b/.test(t);
  if (!ehLista && !ehAgendar) return { acao: "desconhecido" };
  p.pegar(/^(?:minha agenda|agendar|agende|agenda|marcar|marque|nova reuniao|reuniao)(?= |$)/);

  // "obs ..." até o fim vira observação
  let obs: string | null = null;
  const iObs = p.norm.findIndex((w) => /^(obs|observacao|observacoes)$/.test(w.replace(/:$/, "")));
  if (iObs >= 0) {
    obs = p.orig.slice(iObs + 1).join(" ").replace(/^[:\-–\s]+/, "").trim() || null;
    for (let i = iObs; i < p.orig.length; i++) p.usada[i] = true;
  }

  const data = lerData(p, h);
  const hora = lerHora(p);
  const duracao = lerDuracao(p);
  if (ehLista && !hora) return { acao: "listar", data: data || somarDias(h, 0) };

  const servico = acharServico(p, servicos);
  const resto = p.restoOrig().filter((w) => !LIGACOES.has(normalizar(w))).join(" ").trim();
  const { cliente, ambiguos } = acharCliente(resto, clientes);
  const clienteNovo = !cliente && !ambiguos.length && resto.replace(/\s/g, "").length >= 3 ? titulo(resto) : null;
  return { acao: "agendar", data, hora, duracao, cliente, clienteNovo, ambiguos, servico, obs };
}

export const AJUDA = [
  "📅 *Agenda Pro pelo WhatsApp*",
  "",
  "*Agendar:* agendar Maria Souza amanhã 10h reunião",
  "Também: _dia 15 às 14:30_, _sexta 9h_, _20/10 15h30_, _por 30 min_, _obs trazer documentos_",
  "",
  "*Ver agenda:* agenda hoje · agenda amanhã · agenda 20/10",
  "*Desfazer o último:* cancelar",
].join("\n");
