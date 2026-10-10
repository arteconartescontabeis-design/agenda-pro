# Serviço artecon-whats: guardar as mensagens recebidas

Para a equipe agendar reuniões mandando mensagem ao WhatsApp da Artecon, o
serviço `artecon-whats` (servidor ARTEDB01) precisa **gravar o que recebe** na
tabela `cob_whatsapp_recebidas` (projeto Supabase do Cobrança). O resto já
está pronto: a função `agenda-whats` lê essa tabela a cada 30 s, só considera
os números da equipe cadastrados no Agenda Pro e responde pela fila de sempre.

## Versão pronta: artecon-whats v1.4.0 (10/10/2026)

O arquivo completo está no OneDrive, em
`Aplicativo Criado Artecon/Agenda Pro/Versão Atual/Atualização WhatsApp v1.4.0/artecon-whats.js`.
Foi feito a partir da v1.3.1 (a da pasta `Versão Atual`), então também leva o
Pix copia e cola e a conferência da chave Pix (v1.3.0 e v1.3.1).

O que muda na v1.4.0:
- guarda as mensagens de **texto** recebidas em conversas individuais (grupos,
  status, canais, fotos, áudios e figurinhas ficam de fora);
- contatos que chegam como `@lid` têm o número buscado em `remoteJidAlt` /
  `senderPn` ou no mapa da biblioteca (`signalRepository.lidMapping`);
- mensagens que chegam com o serviço reconectando (`append`) só entram se
  forem dos últimos 30 minutos;
- grava com o mesmo usuário do robô (política `cob_whatsapp_recebidas_ins`;
  conferido em 10/10/2026 que esse usuário tem permissão);
- respostas aos comandos da equipe (`contexto.tipo = "resposta_comando"`)
  saem só em texto, sem o logotipo;
- erro ao guardar uma mensagem recebida nunca atrapalha o envio (só um aviso no log).

### Como instalar no ARTEDB01
1. Parar o serviço (fechar a janela do `node artecon-whats.js` ou parar o que o liga).
2. Na pasta do serviço, renomear o `artecon-whats.js` atual para `artecon-whats-antigo.js` (cópia de segurança).
3. Copiar o novo `artecon-whats.js` da pasta do OneDrive para a pasta do serviço.
4. **Não apagar** a pasta `sessao` (é o pareamento), nem `config.json` e `logo.jpg`.
5. (Opcional) `node artecon-whats.js --checar` para conferir o acesso ao banco.
6. Ligar o serviço como sempre. Não é preciso ler o QR Code de novo.
7. Conferir no Cobrança Pro → Robô → WhatsApp: "Conectado" e versão **1.4.0**.

O serviço só envia entre `hora_inicio` e `hora_fim` do `config.json` (padrão 8h–20h).
Uma mensagem de comando mandada fora desse horário é registrada no Agenda, mas a
resposta só sairia no horário de envio, e a fila expira à meia-noite.

## Trecho genérico (para outro serviço Baileys)

Logo depois de criar a conexão (`sock`), junto dos outros `sock.ev.on(...)`.
Os nomes `supabase`, `TENANT_ID` e `log` devem ser trocados pelos que o
serviço já usa.

```js
// v1.4.0: guarda as mensagens de texto recebidas (conversas individuais)
sock.ev.on('messages.upsert', async ({ messages, type }) => {
  if (type !== 'notify') return;
  for (const m of messages) {
    try {
      if (!m.message || m.key.fromMe) continue;
      const jid = m.key.remoteJid || '';
      if (jid.endsWith('@g.us') || jid === 'status@broadcast' || jid.endsWith('@newsletter')) continue;
      // contatos novos podem vir como "@lid": o número fica em senderPn / remoteJidAlt
      const jidNumero = jid.endsWith('@lid') ? (m.key.senderPn || m.key.remoteJidAlt || '') : jid;
      let tel = String(jidNumero.split('@')[0] || '').replace(/\D/g, '');
      if ((tel.length === 12 || tel.length === 13) && tel.startsWith('55')) tel = tel.slice(2);
      if (tel.length < 10) continue;
      const msg = m.message.ephemeralMessage?.message || m.message;
      const texto = msg.conversation || msg.extendedTextMessage?.text || '';
      if (!texto.trim()) continue;
      const { error } = await supabase.from('cob_whatsapp_recebidas').insert({
        tenant_id: TENANT_ID,
        telefone: tel,
        jid,
        nome: m.pushName || null,
        texto: texto.slice(0, 2000),
        id_mensagem: m.key.id,
        recebido_em: new Date(Number(m.messageTimestamp || Date.now() / 1000) * 1000).toISOString(),
      });
      if (error && !/duplicate key/i.test(error.message)) log('mensagem recebida não gravada: ' + error.message);
    } catch (e) {
      log('erro ao gravar mensagem recebida: ' + e.message);
    }
  }
});
```

Observações:
- Se o serviço usa a chave `service_role`, a gravação passa direto. Se entra
  com usuário e senha, a política `cob_whatsapp_recebidas_ins` já permite
  gravar para quem é do escritório.
- Um erro aqui nunca interrompe o envio das cobranças (fica dentro do `try`).
- Depois de trocar o arquivo, reiniciar o serviço. Não é preciso ler o QR Code
  de novo.
