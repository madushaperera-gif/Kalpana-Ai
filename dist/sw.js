const CACHE_NAME = 'kalpana-ai-v3';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Always fetch from network first to prevent caching developer builds
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
