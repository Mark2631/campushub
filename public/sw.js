// Cache only a small, versioned set of stable offline assets. Never cache Next.js
// JS/CSS bundles or application pages: stale bundles can break deployed updates.
const CACHE_NAME = 'campustrader-offline-v2';
const OFFLINE_ASSETS = ['/favicon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_ASSETS)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
    self.clients.claim(),
  ]));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') return; // Always use the network for pages.
  if (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;
  if (!OFFLINE_ASSETS.includes(url.pathname)) return;
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
