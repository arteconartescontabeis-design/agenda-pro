// Agenda Pro — o app mudou de endereço em 18/10/2026: https://arteconartescontabeis-design.github.io/gestao-financeiro/agenda-pro/
// Este service worker substitui o antigo só para desligá-lo: apaga as cópias guardadas das versões antigas da Agenda,
// cancela o próprio registro e recarrega as janelas abertas, que caem no aviso de mudança de endereço.
// (As cópias de outros apps do mesmo site e a da Agenda nova, agenda-pro-v2.8.1, não são tocadas.)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter(n => n.startsWith('agenda-pro-') && n !== 'agenda-pro-v2.8.1').map(n => caches.delete(n)));
    await self.registration.unregister();
    const janelas = await self.clients.matchAll({ type: 'window' });
    janelas.forEach(j => j.navigate(j.url));
  })());
});
