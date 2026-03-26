const CACHE_NAME = "dnd-tracker-v3";
const ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/pwa/manifest.json",
  "/js/state.js",
  "/js/ui.js",
  "/js/hp.js",
  "/js/hitdice.js",
  "/js/inventory.js",
  "/js/session.js",
  "/js/modals.js",
  "/js/conditions.js",
  "/js/resources.js",
  "/js/spellslots.js",
  "/js/pwa.js",
  "/privacy.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Cache-first for everything — guarantees offline works after force-close.
  // Network-first for navigation was the root cause of the Safari offline error.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // Dynamically cache anything new (e.g. icons, fonts)
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => {
          // Last resort fallback for navigations
          if (req.mode === "navigate") return caches.match("/index.html");
        });
    }),
  );
});
