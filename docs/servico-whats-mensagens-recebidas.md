# Serviço artecon-whats: guardar as mensagens recebidas

Para a equipe agendar reuniões mandando mensagem ao WhatsApp da Artecon, o
serviço `artecon-whats` (servidor ARTEDB01) precisa **gravar o que recebe** na
tabela `cob_whatsapp_recebidas` (projeto Supabase do Cobrança). O resto já
está pronto: a função `agenda-whats` lê essa tabela a cada 30 s, só considera
os números da equipe cadastrados no Agenda Pro e responde pela fila de sempre.

## O que acrescentar no serviço (Baileys)

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
