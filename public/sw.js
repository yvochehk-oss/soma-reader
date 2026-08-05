const CACHE_NAME = "soma-shell-v4";
const APP_SHELL = ["/", "/discover", "/library", "/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  const isReader = url.pathname.startsWith("/read/");
  const isCover = /\.(?:png|jpe?g|webp|avif|svg)$/i.test(url.pathname);
  const isStatic = url.pathname.startsWith("/_next/") || isCover;
  if (!isReader && !isStatic && !APP_SHELL.includes(url.pathname)) return;
  event.respondWith(caches.match(event.request).then(async (cached) => {
    // HTML pages must reflect newly published books and language choices. Cache
    // is strictly an offline fallback; hashed static assets may stay cache-first.
    if (cached && isStatic) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
      return response;
    } catch { return cached || caches.match("/offline"); }
  }));
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_READER_URLS" || !Array.isArray(event.data.urls)) return;
  event.waitUntil(caches.open(CACHE_NAME).then(async (cache) => {
    await Promise.all(event.data.urls.map(async (url) => {
      const response = await fetch(url);
      if (response.ok) await cache.put(url, response);
    }));
  }));
});
