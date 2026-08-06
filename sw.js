/**
 * sw.js - Service Worker for PWA offline support
 * IMPORTANT: Bump CACHE_VERSION (e.g. v1.0.1) on every update
 *            so the browser detects a new version and shows the
 *            "检测到新版本" banner to users.
 */
const CACHE_VERSION = 'v1.5.1';
const CACHE_NAME = 'mining-mgmt-' + CACHE_VERSION;

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './version.json',
  './css/style.css',
  './js/db.js',
  './js/utils.js',
  './js/scanner.js',
  './js/camera.js',
  './js/exporter.js',
  './js/calendar.js',
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

// Fetch - network-first for navigation, stale-while-revalidate for assets
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Network-first for navigation requests (HTML pages)
  // This ensures the browser always gets the latest HTML on page load,
  // which references the newest sw.js and triggers SW update detection.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        return caches.match(event.request).then(cached => {
          return cached || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // Stale-while-revalidate for other assets (JS, CSS, images, etc.)
  // Serve from cache immediately, but also fetch fresh copy in background
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(response => {
        if (response && response.status === 200 && response.url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// Message - skip waiting
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
