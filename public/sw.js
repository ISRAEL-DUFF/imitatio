// Imitatio service worker (spec §5.2, optional PWA). Lets the notebook open
// and be browsed and edited offline; analysis and generation still need the
// network. Requests to other origins (OpenRouter) are never touched.

const CACHE = 'imitatio-v1';
const SHELL = ['/', '/favicon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, fallbackKey) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(fallbackKey ?? request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(fallbackKey ?? request);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Every route is the single-page app: serve the latest index.html, or the
  // cached one when offline.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, '/'));
    return;
  }
  // Hashed build assets never change under the same name.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(networkFirst(request));
});
