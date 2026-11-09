/* Service Worker: Offline-Nutzung (Cache-first, versioniert) */
const VER = 'wet26-v1';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'css/app.css', 'data/program.js', 'js/config.js', 'js/model.js', 'js/store.js', 'js/ui-common.js', 'js/ics.js', 'js/map.js', 'js/app.js',
  'img/eg.webp', 'img/og.webp', 'img/ug.webp', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VER).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).then(res => {
    const copy = res.clone(); caches.open(VER).then(c => c.put(e.request, copy)); return res;
  }).catch(() => caches.match('index.html'))));
});
