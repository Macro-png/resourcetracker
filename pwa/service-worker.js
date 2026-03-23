const CACHE_NAME = 'dnd-tracker-v2';
const BASE = '/resourcetracker';
const ASSETS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/style.css',
  BASE + '/app.js',
  BASE + '/pwa/manifest.json',
  BASE + '/js/state.js',
  BASE + '/js/ui.js',
  BASE + '/js/hp.js',
  BASE + '/js/hitdice.js',
  BASE + '/js/inventory.js',
  BASE + '/js/session.js',
  BASE + '/js/modals.js',
  BASE + '/js/conditions.js',
  BASE + '/js/resources.js',
  BASE + '/js/spellslots.js',
  BASE + '/js/pwa.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Navigation requests → serve index.html fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match(BASE + '/index.html'))
    );
    return;
  }

  // Cache-first for all app assets, network fallback
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      }).catch(() => cached);
    })
  );
});