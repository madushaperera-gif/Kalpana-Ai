const CACHE_NAME = 'kalpana-ai-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/src/style.css',
  '/src/main.js',
  '/src/rif-engine.js',
  '/src/model-runner.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});
