// Service Worker：把整个 App 缓存下来，装到主屏幕后彻底离线可用。
//
// 更新套路：改了任何前端文件，就把下面的版本号 +1（v3 -> v4）。
// 新 SW 装好后会删掉旧缓存，下次打开就是新版。

const CACHE = 'marathon-checkin-v5';

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './src/plan.js',
  './src/progress.js',
  './src/stats.js',
  './src/store.js',
  './src/segments.js',
  './src/timer.js',
  './src/audio.js',
  './src/backup.js',
  './icons/apple-touch-icon-180.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // 后台顺手更新一份，但不阻塞本次返回。
        fetch(request).then((res) => {
          if (res && res.ok) caches.open(CACHE).then((c) => c.put(request, res.clone()));
        }).catch(() => {});
        return cached;
      }
      return fetch(request)
        .then((res) => {
          if (res && res.ok && new URL(request.url).origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'));
    }),
  );
});
