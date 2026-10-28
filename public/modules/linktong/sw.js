const CACHE_NAME = 'link-tree-cache-v7'; // Tăng version để trình duyệt cập nhật
const urlsToCache = [
  './',
  './index.html',
  './links.json',       // QUAN TRỌNG: Phải cache file này để hiện link khi offline
  './qrcode.png',
  './manifest.json',
  './icon-192x192.png', // Đã mở comment
  './icon-512x512.png'  // Đã mở comment
];

// 1. Quá trình cài đặt: Lưu các file vào Cache và ép kích hoạt
self.addEventListener('install', event => {
  self.skipWaiting(); // Ép bản mới nhất vượt qua trạng thái waiting
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Đã mở cache v7');
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. Kích hoạt và dọn dẹp cache cũ
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim()); // Giành quyền kiểm soát trang ngay lập tức
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Đã xóa cache cũ:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 3. Phản hồi yêu cầu (Fetch): Ưu tiên mạng, dự phòng bằng cache
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // Nếu có mạng, lưu bản mới nhất của request này vào cache
        // (Rất hữu ích để links.json luôn được cập nhật ngầm)
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          // Chỉ đưa vào cache nếu request dùng giao thức http/https
          if(event.request.url.startsWith('http')){
            cache.put(event.request, responseClone);
          }
        });
        return networkResponse;
      })
      .catch(() => {
        // Nếu mất mạng, lôi từ cache ra
        return caches.match(event.request).then(response => {
            if (response) {
                return response;
            }
            // Dự phòng cho điều hướng trang
            if (event.request.mode === 'navigate') {
                return caches.match('./index.html');
            }
            return undefined;
        });
      })
  );
});
