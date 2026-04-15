'use strict';

// ============================================================
// TERMINAL ELITE HORIZON — Service Worker (PWA)
// Stratégie : Cache-first pour les assets statiques
//             Network-only pour l'API (/api/*)
// ============================================================

const CACHE  = 'elite-horizon-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/manifest.json',
  '/icons/icon.svg',
  '/js/config.js',
  '/js/auth.js',
  '/js/engine.js',
  '/js/app.js',
  // CDN — Chart.js + date adapter
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.bundle.min.js',
];

// ── Install : pré-cache des assets ───────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => {
      return Promise.allSettled(ASSETS.map(url => cache.add(url)));
    })
  );
  self.skipWaiting();
});

// ── Activate : nettoyage des anciens caches ───────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch : routage des requêtes ──────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // API : toujours réseau (pas de cache)
  if (url.pathname.startsWith('/api/')) return;

  // Google Fonts : network-first (mise en cache dynamique)
  if (url.hostname.includes('fonts.g')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Tout le reste : cache-first
  event.respondWith(cacheFirst(request));
});

// ── Stratégies ────────────────────────────────────────────────

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline fallback : retourner le shell HTML
    return caches.match('/index.html');
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return caches.match(request);
  }
}
