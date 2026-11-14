const APP_SHELL_CACHE = '__INTERIORS_APP_SHELL_CACHE__';
const BROWSE_CACHE = '__INTERIORS_BROWSE_CACHE__';
const APP_SHELL = __INTERIORS_APP_SHELL__;
const RELEASE_MANIFEST = __INTERIORS_RELEASE_MANIFEST__;
const APP_SHELL_CACHE_PREFIX = 'interiors-editor-shell-';
const BROWSE_CACHE_PREFIX = 'interiors-editor-browse-';
// Release marker 2026-08-29-pwa-update-v2: makes the staged worker distinct
// without changing the Project schema, cache contract, or editor behavior.

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.clients.claim()
      .then(() => caches.keys())
      .then((keys) => Promise.all(keys
        .filter((key) =>
          (key.startsWith(APP_SHELL_CACHE_PREFIX) && key !== APP_SHELL_CACHE) ||
          (key.startsWith(BROWSE_CACHE_PREFIX) && key !== BROWSE_CACHE)
        )
        .map((key) => caches.delete(key))))
  );
});

self.addEventListener('message', (event) => {
	if (event.data?.type === 'INTERIORS_RELEASE_MANIFEST') {
		event.ports[0]?.postMessage({ kind: 'release-manifest', manifest: RELEASE_MANIFEST });
	}
  if (event.data?.type === 'INTERIORS_ACTIVATE_UPDATE') {
    event.waitUntil(self.skipWaiting());
  }
  if (event.data?.type === 'INTERIORS_CLEAR_BROWSE_CACHE') {
    event.waitUntil(
      clearBrowseCache()
        .then(() => event.ports[0]?.postMessage({ kind: 'cleared' }))
        .catch(() => event.ports[0]?.postMessage({ kind: 'unavailable' }))
    );
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) {
    return;
  }
  // The Cache API cannot store a 206 response.  Catalog GLB resources are
  // deliberately assembled from byte ranges, so forward them untouched rather
  // than turning a successful network response into Response.error().
  if (event.request.headers.has('range')) {
    event.respondWith(fetch(event.request));
    return;
  }
  // Catalog publications and immutable resources belong to the remote
  // control plane. They must never become a hidden offline source of truth in
  // the Project PWA cache; the CatalogGateway verifies every response.
  if (new URL(event.request.url).pathname.startsWith('/catalog-api/')) {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith(cacheFirst(event.request));
});

async function cacheFirst(request) {
  const cache = await caches.open(cacheNameFor(request));
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    if (request.mode === 'navigate') {
      const shell = await cache.match('/index.html');
      if (shell) {
        return shell;
      }
    }
    return Response.error();
  }
}

function cacheNameFor(request) {
  return APP_SHELL.includes(new URL(request.url).pathname)
    ? APP_SHELL_CACHE
    : BROWSE_CACHE;
}

async function clearBrowseCache() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter((cacheName) => cacheName.startsWith(BROWSE_CACHE_PREFIX))
      .map((cacheName) => caches.delete(cacheName))
  );
}
