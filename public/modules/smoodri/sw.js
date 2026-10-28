// SmooDri Offline — mỗi bản phát hành có cache riêng.
const CACHE_NAME = 'smoodri-offline-v8';
const PREFIX = 'smoodri-offline-';
const CORE = [
  './', './index.html', './style.css', './app.js', './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png',
  './icons/icon-maskable.png', './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];
self.addEventListener('install', (event) => {
  // Lỗi tải file cốt lõi phải làm install thất bại; tránh offline thiếu JS/CSS.
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE_NAME)
      .map((key) => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const isCode = req.mode === 'navigate' ||
    /\/(?:index\.html|app\.js|style\.css)$/.test(url.pathname);
  if (isCode) {
    event.respondWith(fetch(req).then((resp) => {
      if (resp.ok) { const copy = resp.clone(); event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(req, copy))); }
      return resp;
    }).catch(async () => {
      const cached = await caches.match(req);
      return cached || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error());
    }));
  } else {
    event.respondWith(caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        if (resp.ok) { const copy = resp.clone(); event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(req, copy))); }
        return resp;
      });
    }));
  }
});
