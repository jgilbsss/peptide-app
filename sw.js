// Offline shell cache. Cross-origin data is never intercepted or persisted.
// The retired standalone page is explicitly unavailable, including while offline.
const CACHE = 'peptide-app-v11';
const CACHE_PREFIX = 'peptide-app-';
const PRECACHE = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // GitHub Gist responses and every other cross-origin response stay out of
  // this origin's Cache Storage. Non-GET requests are never intercepted.
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (url.pathname.endsWith('/standalone-index.html')) {
    e.respondWith(Promise.resolve(new Response('Gone', {
      status: 410,
      statusText: 'Gone',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store'
      }
    })));
    return;
  }

  const isShell = e.request.mode === 'navigate' ||
                  url.pathname.endsWith('/index.html') ||
                  url.pathname.endsWith('/');
  const req = isShell ? new Request(e.request, { cache: 'reload' }) : e.request;

  e.respondWith(
    fetch(req)
      .then(response => {
        if (!response.ok) return response;
        const copy = response.clone();
        return caches.open(CACHE)
          .then(cache => cache.put(e.request, copy))
          .then(() => response)
          .catch(() => response);
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
