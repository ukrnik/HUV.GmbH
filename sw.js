// Simple service worker for a static landing
// Strategies:
// - Navigation: network-first, fallback to /index.html when offline
// - Assets (css/js/img/font): cache-first
// - Partials (/partials/...): stale-while-revalidate

const CACHE_VERSION = 'v1.1.0'; // ↑ bump on every release
const STATIC_CACHE = `static-${CACHE_VERSION}`;

// List only real, existing files (paths from site root)
const PRECACHE_URLS = [
    './index.html',
    './css/styles.css',
    './js/main.js',
    './img/HUV_logo.png',
    './favicon.ico',
    './favicon.svg',
    './favicon-96x96.png',
    './apple-touch-icon.png',
    './site.webmanifest',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then(async (cache) => {
            try {
                await cache.addAll(PRECACHE_URLS);
            } catch (e) {
                // Helps detect missing files/CORS issues during install
                console.warn('Precache failed:', e);
            }
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => (k === STATIC_CACHE ? null : caches.delete(k))));
            await self.clients.claim();
        })()
    );
});

// Allow page to trigger instant activation of a new SW
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);

    // Only same-origin GET
    if (req.method !== 'GET' || url.origin !== location.origin) return;

    // Page navigations -> network-first, offline fallback to index.html
    if (req.mode === 'navigate') {
        event.respondWith(fetch(req).catch(() => caches.match('/index.html')));
        return;
    }

    const dest = req.destination;

    // Static assets -> cache-first (note: we respect ?v=... by not ignoring search)
    if (['style', 'script', 'image', 'font'].includes(dest)) {
        event.respondWith(cacheFirst(req));
        return;
    }

    // HTML partials -> stale-while-revalidate
    if (url.pathname.startsWith('/partials/')) {
        event.respondWith(staleWhileRevalidate(req));
    }
});

async function cacheFirst(req) {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(req);
    if (cached) return cached;

    const res = await fetch(req);
    // Cache only successful, basic/opaque-safe responses
    if (res.ok && (res.type === 'basic' || res.type === 'default')) {
        cache.put(req, res.clone());
    }
    return res;
}

async function staleWhileRevalidate(req) {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(req);

    const networkPromise = fetch(req)
        .then((res) => {
            if (res.ok && (res.type === 'basic' || res.type === 'default')) {
                cache.put(req, res.clone());
            }
            return res;
        })
        .catch(() => undefined);

    return cached || networkPromise;
}
