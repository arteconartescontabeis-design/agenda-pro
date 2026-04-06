// Agenda Pro — Service Worker
const CACHE_NAME = 'agenda-pro-v1';

// Arquivos que ficam em cache para funcionar offline
const ASSETS = [
  '/agenda-pro/app.html',
  '/agenda-pro/manifest.json',
  '/agenda-pro/icons/icon-192.png',
  '/agenda-pro/icons/icon-512.png'
];

// Instalação — faz cache dos arquivos estáticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Ativação — limpa caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Requisições — tenta rede primeiro, cai no cache se offline
self.addEventListener('fetch', event => {
  // Ignora requisições ao Supabase (sempre precisa de rede)
  if (event.request.url.includes('supabase.co')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Atualiza cache com resposta mais recente
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
