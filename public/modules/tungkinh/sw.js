/* ==========================================================================
   Service Worker - Ứng dụng "Tụng Kinh"
   --------------------------------------------------------------------------
   CHIẾN LƯỢC CACHE
   1. Điều hướng trang (HTML): NETWORK-FIRST -> luôn mới khi có mạng, mất mạng
      thì trả HTML đã cache. Cache dùng khoá chuẩn hoá (bỏ ?s=...) để không
      sinh vô số entry theo từng link chia sẻ.
   2. ./data.js (nội dung)   : NETWORK-FIRST -> tránh tụng lại bản kinh cũ sau
      khi cập nhật; mất mạng thì lấy bản đã cache.
   3. Tài nguyên tĩnh khác   : STALE-WHILE-REVALIDATE (trả cache ngay, cập nhật
      nền) -> mở app nhanh: icon, qrcode, manifest.
   4. Tài nguyên CDN         : STALE-WHILE-REVALIDATE + lưu dạng OPAQUE
      (cdn.tailwindcss.com)    (best-effort) để offline vẫn còn giao diện.
   --------------------------------------------------------------------------
   LƯU Ý KỸ THUẬT - KHÔNG LẶP LẠI LỖI CŨ:
   - KHÔNG precache URL cross-origin bằng cache.addAll(): CDN không trả header
     Access-Control-Allow-Origin và addAll() chỉ nhận response 2xx (response
     opaque status 0 cũng bị reject) => 1 URL lỗi là install thất bại, toàn bộ
     Service Worker ngừng hoạt động (mất offline) mà rất khó phát hiện.
   - Vì vậy: tài nguyên cùng origin cache TỪNG URL (bọc try/catch), tài nguyên
     CDN dùng fetch(mode:'no-cors') + cache.put() (put cho phép response opaque).
   ========================================================================== */

/* -------------------------------- Tiện ích ------------------------------- */

/** Origin của URL - dùng để nhận diện tài nguyên CDN lúc runtime */
function toOrigin(url) {
  try { return new URL(url, self.location).origin; } catch (error) { return ''; }
}

/** Pathname đã resolve theo phạm vi của service worker */
function toPathname(url) {
  try { return new URL(url, self.location).pathname; } catch (error) { return ''; }
}

/**
 * Khoá cache cho tài nguyên cross-origin: origin + pathname (bỏ query).
 * Luôn dùng CÙNG khoá khi ghi và khi đọc để tránh trượt cache do header Vary
 * (CDN có trả 'vary' nên khoá dạng chuỗi là cách an toàn nhất).
 */
function crossOriginKey(url) {
  try { const parsed = new URL(url); return parsed.origin + parsed.pathname; } catch (error) { return url; }
}

/** Response nào được phép ghi vào cache? */
function isCacheable(response) {
  if (!response) return false;
  if (response.type === 'opaqueredirect') return false; // redirect "manual": không dùng được
  if (response.type === 'opaque') return true;          // tài nguyên CDN không CORS
  return response.status === 200;                       // chỉ lưu 200 (bỏ 206/404/5xx)
}

/** Response có phải tài liệu HTML? (tránh cache ảnh/download vào khoá HTML) */
function isHtmlResponse(response) {
  const contentType = (response.headers && response.headers.get('Content-Type')) || '';
  return contentType.toLowerCase().includes('text/html');
}

/** Ghi cache an toàn: lỗi ghi cache KHÔNG được làm hỏng response trả cho trang */
function putInCache(cacheKey, response) {
  return caches.open(CACHE_NAME)
    .then(cache => cache.put(cacheKey, response))
    .catch(error => console.warn('[SW] Không ghi được cache:', cacheKey, error));
}

/** Chạy nền nhưng vẫn nằm trong vòng đời event nếu event còn hiệu lực */
function runInBackground(event, taskPromise) {
  try { event.waitUntil(taskPromise); } catch (error) { /* event đã kết thúc: lần tải sau sẽ cập nhật tiếp */ }
}

/** fetch có giới hạn thời gian; quá hạn trả null để nơi gọi dùng bản cache */
function fetchWithTimeout(request, timeoutMs) {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    fetch(request).then(
      response => { clearTimeout(timer); resolve(response); },
      () => { clearTimeout(timer); resolve(null); }
    );
  });
}

/** Trang dự phòng khi mất mạng mà chưa có bản cache (lần mở offline đầu tiên) */
function offlineFallbackPage() {
  return new Response(
    '<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Tụng Kinh - Ngoại tuyến</title></head>' +
    '<body style="font-family:system-ui,sans-serif;padding:24px;text-align:center;">' +
    '<h1 style="color:#4f46e5;">Đang ngoại tuyến</h1>' +
    '<p>Ứng dụng chưa lưu được dữ liệu cho lần dùng ngoại tuyến này.<br>' +
    'Vui lòng bật mạng, mở lại ứng dụng một lần rồi sau đó có thể dùng offline.</p>' +
    '</body></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

/* ------------------------------- Cấu hình -------------------------------- */

/** Đổi CACHE_VERSION mỗi khi thay đổi danh sách/chiến lược cache */
const CACHE_VERSION = 'v8';
const CACHE_PREFIX = 'tung-kinh-cache-';
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;

/** Tài nguyên cùng origin - bắt buộc có để ứng dụng chạy được khi offline */
const PRECACHE_URLS = [
  './',
  './index.html',
  './data.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './qrcode.png'
];

/** Tài nguyên cross-origin (không có CORS header) - cache opaque, best-effort */
const CDN_URLS = [
  'https://cdn.tailwindcss.com'
];

/** Origin các CDN trên - dùng để nhận diện request lúc runtime */
const CDN_ORIGINS = CDN_URLS.map(toOrigin).filter(Boolean);

/** Tài nguyên ưu tiên "tươi mới" (network-first) */
const NETWORK_FIRST_URLS = ['./data.js'].map(toPathname).filter(Boolean);

/** Khoá cache chuẩn hoá cho HTML - không kèm ?s=... để cache không phình */
const OFFLINE_URL = './index.html';

/** Thời gian chờ mạng tối đa khi điều hướng, quá hạn thì dùng cache (ms) */
const NAVIGATION_TIMEOUT_MS = 4000;

/** Bỏ qua HTTP cache khi precache để chắc chắn lấy bản mới */
const RELOAD = 'reload';

/* --------------------------- Cài đặt / kích hoạt ------------------------- */

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // (1) Tài nguyên cùng origin: cache TỪNG URL để một file lỗi không kéo sập
    //     cả install (cache.addAll() là "được ăn cả, ngã về không").
    await Promise.all(PRECACHE_URLS.map(async url => {
      try {
        await cache.add(new Request(url, { cache: RELOAD }));
      } catch (error) {
        console.warn('[SW] Bỏ qua tài nguyên không tải được khi cài:', url, error);
      }
    }));

    // (2) Tài nguyên CDN: fetch 'no-cors' -> response opaque -> cache.put().
    //     Lỗi ở bước này KHÔNG ảnh hưởng cài đặt, chỉ mất phần giao diện offline.
    await Promise.all(CDN_URLS.map(async url => {
      try {
        const response = await fetch(new Request(url, { mode: 'no-cors', cache: RELOAD }));
        if (isCacheable(response)) {
          await cache.put(crossOriginKey(url), response);
        }
      } catch (error) {
        console.warn('[SW] Không cache được tài nguyên CDN:', url, error);
      }
    }));

    // (3) Chỉ chuyển sang SW mới SAU khi đã precache xong
    //     (tránh nhận ứng dụng với cache rỗng khi precache thất bại).
    await self.skipWaiting();
    console.log('[SW] Đã cài đặt', CACHE_NAME);
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Chỉ xoá cache của CHÍNH ứng dụng này - tránh xoá cache của ứng dụng khác
    // cùng origin (ví dụ các app GitHub Pages khác trên cùng tài khoản).
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
        .map(name => caches.delete(name))
    );

    await self.clients.claim();
    console.log('[SW] Đã kích hoạt', CACHE_NAME);
  })());
});

/* ------------------------------- Chiến lược ------------------------------ */

/** NETWORK-FIRST: lấy bản mới khi có mạng, mất mạng thì trả bản đã cache */
async function networkFirst(event, cacheKey) {
  try {
    const response = await fetch(event.request);
    if (isCacheable(response)) {
      runInBackground(event, putInCache(cacheKey, response.clone()));
      return response;
    }
    // Phản hồi lỗi (404/5xx) hoặc redirect "manual": thử cache bên dưới
  } catch (error) {
    // Mất mạng hoàn toàn: dùng cache bên dưới
  }
  return (await caches.match(cacheKey, { ignoreSearch: true, ignoreVary: true })) || null;
}

/** STALE-WHILE-REVALIDATE: trả cache ngay, cập nhật nền cho lần tải sau */
async function staleWhileRevalidate(event, cacheKey) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(cacheKey, { ignoreVary: true });

  const networkTask = fetch(event.request).then(response => {
    if (isCacheable(response)) {
      runInBackground(event, putInCache(cacheKey, response.clone()));
    }
    return response;
  }).catch(() => null);

  if (cached) return cached;
  return (await networkTask) || Response.error();
}

/**
 * Điều hướng trang: network-first có giới hạn thời gian (mạng yếu không bị treo),
 * fallback HTML đã cache, cuối cùng là trang thông báo ngoại tuyến.
 */
/** Làm sạch cờ redirected để trình duyệt không chặn khi điều hướng offline */
function cleanRedirect(response) {
  if (!response || !response.redirected) return response;
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

async function handleNavigation(event) {
  const response = await fetchWithTimeout(event.request, NAVIGATION_TIMEOUT_MS);

  if (response && response.status === 200) {
    if (isHtmlResponse(response)) {
      const cleanResp = cleanRedirect(response.clone());
      runInBackground(event, putInCache(OFFLINE_URL, cleanResp));
    }
    return response;
  }

  // Tìm theo OFFLINE_URL ('./index.html'), nếu không có thì tìm tiếp theo './' hoặc request hiện tại
  const cached =
    (await caches.match(OFFLINE_URL, { ignoreSearch: true, ignoreVary: true })) ||
    (await caches.match('./', { ignoreSearch: true, ignoreVary: true })) ||
    (await caches.match(event.request, { ignoreSearch: true, ignoreVary: true }));

  return cached ? cleanRedirect(cached) : offlineFallbackPage();
}
      


/** ./data.js: network-first; cả mạng lẫn cache đều hỏng thì báo lỗi tải dữ liệu */
async function handleContentScript(event) {
  const response = await networkFirst(event, event.request.url);
  return response || Response.error();
}
      
/* --------------------------- Điều phối request --------------------------- */

self.addEventListener('fetch', event => {
  const request = event.request;

  // (1) Chỉ xử lý GET qua http(s); các request khác để trình duyệt tự xử lý
  if (request.method !== 'GET') return;

  let url;
  try { url = new URL(request.url); } catch (error) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // (2) Tránh TypeError của fetch() với request 'only-if-cached' khác origin
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;

  // (3) Không can thiệp request dạng Range/partial
  //     (tránh trả nguyên nội dung 200 cho một yêu cầu từng phần)
  if (request.headers.has('range')) return;

  // (4) Điều hướng trang
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(event));
    return;
  }

  // (5) Tài nguyên cùng origin
  if (url.origin === self.location.origin) {
    if (NETWORK_FIRST_URLS.includes(url.pathname)) {
      event.respondWith(handleContentScript(event));
      return;
    }
    event.respondWith(staleWhileRevalidate(event, request.url));
    return;
  }

  // (6) Tài nguyên CDN đã biết: giữ lại để offline vẫn còn giao diện (Tailwind)
  if (CDN_ORIGINS.includes(url.origin)) {
    event.respondWith(staleWhileRevalidate(event, crossOriginKey(url.href)));
    return;
  }

  // (7) Request cross-origin khác: không can thiệp
});
