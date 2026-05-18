// MyStuff Service Worker — offline support and faster loads
// Version bump on each release so old caches get cleared
const CACHE_VERSION = 'mystuff-v1';

// Files that should always be available offline (the "app shell")
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
];

// Install: pre-cache app shell so the app works offline from first install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(err => console.error('[SW] install failed:', err))
  );
});

// Activate: clean up old caches from previous versions
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch:
// - Same-origin: cache-first (instant load, falls back to network)
// - CDN libraries (fonts, QR lib, Tesseract): cache-first with long TTL
// - Everything else: network-first with cache fallback
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === location.origin;
  const isCacheableCDN =
    url.hostname.includes('jsdelivr.net') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com');

  if (isSameOrigin || isCacheableCDN) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(resp => {
          // Cache successful responses for next time
          if (resp.ok && resp.status === 200) {
            const respClone = resp.clone();
            caches.open(CACHE_VERSION).then(c => c.put(req, respClone));
          }
          return resp;
        });
      }).catch(() => {
        // If offline and not cached, return a basic offline response for HTML
        if (req.headers.get('accept')?.includes('text/html')) {
          return caches.match('./index.html');
        }
      })
    );
    return;
  }

  // Default: network-first, fallback to cache
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});

// Allow the page to trigger an update check
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
