/* Buy-xx-master Service Worker
 * Strategy:
 *   - Pre-cache shell (index.html + all assets + manifest) on install
 *   - Cache-first for assets/ (images rarely change)
 *   - Network-first with cache fallback for HTML (so updates work)
 *   - Skip waiting + clients claim so teacher sees updates next reload
 */
const VERSION = 'v1.8-sen-pwa1';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './assets/bag.jpg',
  './assets/case.jpg',
  './assets/pencil.jpg',
  './assets/ruler.jpg',
  './assets/cake.jpg',
  './assets/doll.jpg',
  './assets/milk.jpg',
  './assets/basketball.jpg',
  './assets/football.jpg',
  './assets/puichi-logo.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Only same-origin
  if (url.origin !== self.location.origin) return;

  // Cache-first for assets/
  if (url.pathname.startsWith(self.location.pathname.replace(/\/$/, '') + '/assets/') ||
      url.pathname.includes('/assets/')) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((resp) => {
        const copy = resp.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
        return resp;
      }).catch(() => hit))
    );
    return;
  }

  // Network-first for everything else (HTML / manifest / sw.js)
  e.respondWith(
    fetch(req).then((resp) => {
      const copy = resp.clone();
      caches.open(VERSION).then((c) => c.put(req, copy));
      return resp;
    }).catch(() => caches.match(req))
  );
});
