const CACHE = 'agenda-pro-v3';
const SUPA_PATTERNS = ['supabase.co', 'supabase.io'];

// Instalar SW
self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — cache para assets estáticos, network-first para Supabase
self.addEventListener('fetch', e => {
  const url = e.request.url;
  const isSupa = SUPA_PATTERNS.some(p => url.includes(p));
  if (isSupa) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"error":"offline"}', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }
  // Assets estáticos — cache first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});

// ── NOTIFICAÇÕES COM APP FECHADO ──────────────────────────────────
// Armazena agendamentos enviados pelo app
let _agendamentosPendentes = [];

self.addEventListener('message', e => {
  if (!e.data) return;
  // App envia lista de lembretes programados
  if (e.data.type === 'AGENDAR_LEMBRETES') {
    _agendamentosPendentes = e.data.lembretes || [];
    // Limpar alarmes anteriores e reagendar
    _agendamentosPendentes.forEach(item => {
      const delay = item.disparo - Date.now();
      if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
        setTimeout(() => {
          self.registration.showNotification(item.titulo, {
            body: item.corpo,
            icon: '/agenda-pro/icons/icon-192.png',
            badge: '/agenda-pro/icons/icon-192.png',
            tag: item.key,
            requireInteraction: true,
            vibrate: [200, 100, 200],
            actions: [
              { action: 'concluir',  title: '✓ Concluído' },
              { action: 'reagendar', title: '📅 Reagendar' },
            ],
            data: { agId: item.agId, url: '/agenda-pro/app.html' }
          });
        }, delay);
      }
    });
  }
  if (e.data.type === 'INIT_PUSH') {
    // Confirmação que SW está ativo
    e.source && e.source.postMessage({ type: 'SW_PRONTO' });
  }
});

// Clique na notificação
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const data = e.notification.data || {};
  const agId = data.agId;
  const url  = data.url || '/agenda-pro/app.html';

  if (e.action === 'concluir' && agId) {
    // Abrir app e sinalizar conclusão
    e.waitUntil(
      clients.openWindow(url + '#concluir-' + agId)
    );
    return;
  }
  if (e.action === 'reagendar' && agId) {
    e.waitUntil(
      clients.openWindow(url + '#reagendar-' + agId)
    );
    return;
  }
  // Clique no corpo — abrir app
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(w => w.url.includes('agenda-pro'));
      if (existing) { existing.focus(); return; }
      return clients.openWindow(url);
    })
  );
});
