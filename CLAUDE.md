# Agenda Pro — memória do projeto

App de agendamento da **Artecon** (escritório contábil). Tudo em português.
Publicado pelo GitHub Pages: https://arteconartescontabeis-design.github.io/agenda-pro/app.html

## Estrutura
- `app.html` — o app inteiro (HTML + CSS + JS). Supabase via REST (`supa`/`supaWithAuth`), anon key no cliente, protegido por RLS.
- `service-worker.js` — cache: páginas vêm sempre da internet (cópia só sem conexão); `version.json` nunca é guardado.
- `version.json` — número da versão publicada; o app compara com `APP_VERSAO` e mostra o aviso "Nova versão disponível".
- `sql/` — migrations já aplicadas (registro). `supabase/functions/` — Edge Functions publicadas.
- `docs/` — instruções para o servidor (serviço de WhatsApp).

## Versão e histórico (obrigatório a cada mudança no app)
1. Subir `APP_VERSAO` no `app.html` (padrão `X.Y.Z`: Z = correção, Y = novidade, X = mudança grande).
2. Acrescentar a versão **no topo** de `VERSOES` (data `dd/mm/aaaa` e itens em linguagem simples, para o usuário).
3. Trocar `versao` em `version.json`.
4. Trocar `CACHE_NAME` no `service-worker.js` para `agenda-pro-vX.Y.Z`.
O número aparece no topo de todas as telas e no login; tocar nele abre o histórico.

## Publicação
- Desenvolver no ramo da sessão e abrir pull request para `main`. Publicar (juntar) **só com autorização do usuário**.
- O GitHub Pages publica sozinho em ~1 min depois do merge.

## Supabase
- Projeto do Agenda: `vuwgxndahrzinfdlapxz` (compartilhado com o Financeiro Pro, tabelas `fin_*`). Tabelas `agenda_*`, multi-escritório por `tenant_id` (Artecon = 2).
- Mudanças de banco: só **acrescentar** (comandos que apagam pedem confirmação do usuário). Registrar em `sql/`.
- Edge Functions:
  - `agenda-whats` (index.ts + comandos.ts): avisos ao cliente e comandos da equipe por WhatsApp. Roda pelo pg_cron a cada 30 s.
  - `agenda-equipe`: cadastra pessoa da equipe (cria o login com senha provisória ou reaproveita o existente).

## WhatsApp (mesmo número do Cobrança Pro)
- O serviço `artecon-whats` (servidor ARTEDB01, código fora do GitHub) envia o que está em `cob_whatsapp_fila` no projeto do Cobrança (`yeujqjtjqtegsnzwwazb`).
- O Agenda entra nessa fila só por `cob_agenda_enfileirar` / `cob_agenda_status` / `cob_agenda_recebidas` (token no cofre do projeto do Agenda: `vault` → `cob_agenda_token`; no Cobrança fica só o hash em `cob_agenda_integracao`).
- Avisos: `agenda_whats_avisos` (gatilho em `agenda_agendamentos` + `agenda_whats_gerar_lembretes`). Liberação por escritório em `agenda_whats_tenants`. Tipos ligados em `agenda_config` (`whats_*`). Nada sai entre 21h e 7h (só teste).
- Comandos da equipe: o serviço precisa gravar o que recebe em `cob_whatsapp_recebidas` (trecho em `docs/servico-whats-mensagens-recebidas.md` — **pendente de instalar no servidor**). Registro em `agenda_whats_comandos`. Só números em `agenda_usuarios.whatsapp` são atendidos.

## Regras
- Dado do banco que vai para `innerHTML` passa por `whatsEsc` no código novo.
- Interface de celular: barra inferior (`UI`, `uiIniciar`), modo simples (`renderHoje`) para colaborador e modo controlador (`renderPainel`) para admin/gerente.
- O interpretador `AGCMD` dentro do `app.html` é a cópia em JS de `supabase/functions/agenda-whats/comandos.ts`: mudou um, mudar o outro.
