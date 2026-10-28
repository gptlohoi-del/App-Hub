const CACHE_NAME = "piano-pwa-v2"; // Cứ đổi số v2, v3... khi cần ép xóa cache cũ

self.addEventListener("install", (e) => {
  self.skipWaiting(); // Kích hoạt ngay Service Worker mới mà không cần đợi đóng tab
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key); // Tự động xóa sạch cache cũ rích trên trình duyệt người dùng
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Cơ chế: Luôn tải file mới nhất từ mạng, nếu offline mới dùng cache
self.addEventListener("fetch", (e) => {
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Lưu bản mới nhất vào cache ngầm
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, resClone);
        });
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
