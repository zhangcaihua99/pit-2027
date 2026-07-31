/**
 * sw.js - Service Worker for PWA offline support
 * IMPORTANT: Bump CACHE_VERSION (e.g. v1.0.1) on every update
 *            so the browser detects a new version and shows the
 *            "检测到新版本" banner to users.
 */
const CACHE_VERSION = 'v1.0.11';
const CACHE_NAME = 'mining-mgmt-' + CACHE_VERSION;

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/db.js',
  './js/utils.js',
  './js/scanner.js',
  './js/camera.js',
  './js/exporter.js',
  './js/app.js',
  './lib/html5-qrcode.min.js',
  './lib/xlsx.full.min.js',
  './lib/html2canvas.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Install - cache all assets, skip waiting immediately
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
});

// Activate - clean old caches, claim clients immediately
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch - cache-first strategy
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache new resources (same-origin only)
        if (response && response.status === 200 && response.url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// Message - skip waiting
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
