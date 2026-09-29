const CACHE_NAME = "soma-shell-v4";
const REQUIRED_READER_ASSETS = ["/reader-static.css", "/reader-static.js"];
const OPTIONAL_APP_SHELL = ["/", "/discover", "/library", "/offline"];
const DB_NAME = "soma-offline";
const STORE_NAME = "chapters";

function safeSlug(segment) {
  try {
    const slug = decodeURIComponent(segment);
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : null;
  } catch {
    return null;
  }
}

function optionalShellFetch(cache, path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  const url = new URL(path, self.location.origin);
  return fetch(new Request(url.href, { signal: controller.signal }))
    .then((response) => response.ok ? cache.put(path, response) : undefined)
    .catch(() => undefined)
    .finally(() => clearTimeout(timer));
}

function removeOfflineRecords(bookSlug, { keepNumbers, onlyNumbers } = {}) {
  if (!self.indexedDB) return Promise.resolve(0);
  return new Promise((resolve) => {
    let createdDuringCleanup = false;
    const request = self.indexedDB.open(DB_NAME);
    request.onupgradeneeded = (event) => { createdDuringCleanup = event.oldVersion === 0; };
    request.onerror = () => resolve(0);
    request.onsuccess = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.close();
        if (createdDuringCleanup) {
          const deletion = self.indexedDB.deleteDatabase(DB_NAME);
          deletion.onsuccess = deletion.onerror = deletion.onblocked = () => resolve(0);
        } else resolve(0);
        return;
      }

      let removed = 0;
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        database.close();
        resolve(removed);
      };
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const keys = store.getAllKeys();
      keys.onsuccess = () => {
        const prefix = `${bookSlug}:`;
        for (const key of keys.result) {
          if (typeof key !== "string" || !key.startsWith(prefix)) continue;
          const chapterNumber = Number(key.slice(prefix.length));
          const shouldDelete = onlyNumbers
            ? onlyNumbers.has(chapterNumber)
            : !keepNumbers || !keepNumbers.has(chapterNumber);
          if (shouldDelete) {
            store.delete(key);
            removed += 1;
          }
        }
      };
      transaction.oncomplete = finish;
      transaction.onerror = finish;
      transaction.onabort = finish;
    };
  });
}

async function removeBookCache(bookSlug, keepNumbers, { removeManifest = false } = {}) {
  const cache = await caches.open(CACHE_NAME);
  const encodedSlug = encodeURIComponent(bookSlug);
  const readerPrefix = `/read/${encodedSlug}/`;
  const dataPrefix = `/reader-data/${encodedSlug}/`;
  const requests = await cache.keys();
  await Promise.all(requests.map(async (request) => {
    const pathname = new URL(request.url).pathname;
    let chapterNumber;
    let isChapterPath = false;
    let isManifest = false;
    if (pathname.startsWith(readerPrefix)) {
      const match = pathname.slice(readerPrefix.length).match(/^(\d+)\/?$/);
      if (match) { chapterNumber = Number(match[1]); isChapterPath = true; }
    } else if (pathname.startsWith(dataPrefix)) {
      const tail = pathname.slice(dataPrefix.length);
      if (tail === "manifest.json") isManifest = true;
      else {
        const match = tail.match(/^(\d+)\.json$/);
        if (match) { chapterNumber = Number(match[1]); isChapterPath = true; }
      }
    }
    if ((isChapterPath && (!keepNumbers || !keepNumbers.has(chapterNumber))) || (isManifest && removeManifest)) {
      await cache.delete(request);
    }
  }));
}

async function purgeWithdrawnUrl(request) {
  const url = new URL(request.url);
  let match = url.pathname.match(/^\/read\/([^/]+)\/(\d+)\/?$/);
  if (match) {
    const slug = safeSlug(match[1]);
    const number = Number(match[2]);
    if (!slug) return;
    const encodedSlug = encodeURIComponent(slug);
    const cache = await caches.open(CACHE_NAME);
    await Promise.all([
      cache.delete(request),
      cache.delete(new URL(`/read/${encodedSlug}/${number}`, self.location.origin).href),
      cache.delete(new URL(`/reader-data/${encodedSlug}/${number}.json`, self.location.origin).href),
      removeOfflineRecords(slug, { onlyNumbers: new Set([number]) }),
    ]);
    return;
  }

  match = url.pathname.match(/^\/reader-data\/([^/]+)\/(\d+)\.json$/);
  if (match) {
    const slug = safeSlug(match[1]);
    const number = Number(match[2]);
    if (!slug) return;
    const encodedSlug = encodeURIComponent(slug);
    const cache = await caches.open(CACHE_NAME);
    await Promise.all([
      cache.delete(request),
      cache.delete(new URL(`/read/${encodedSlug}/${number}`, self.location.origin).href),
      cache.delete(new URL(`/reader-data/${encodedSlug}/${number}.json`, self.location.origin).href),
      removeOfflineRecords(slug, { onlyNumbers: new Set([number]) }),
    ]);
    return;
  }

  match = url.pathname.match(/^\/reader-data\/([^/]+)\/manifest\.json$/);
  if (match) {
    const slug = safeSlug(match[1]);
    if (!slug) return;
    await Promise.all([
      removeBookCache(slug, undefined, { removeManifest: true }),
      removeOfflineRecords(slug),
    ]);
  }
}

function markOfflineFallback(response) {
  const headers = new Headers(response.headers);
  headers.set("x-soma-reader-cache", "offline");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Reader controls and styles are essential for this worker's offline reader contract.
    await cache.addAll(REQUIRED_READER_ASSETS);
    // These app pages may be dynamic SSR routes. Their failure must not prevent the
    // worker from installing for reader pages and chapter data.
    await Promise.allSettled(OPTIONAL_APP_SHELL.map((path) => optionalShellFetch(cache, path)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys()
    .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const isReader = url.pathname.startsWith("/read/");
  const isReaderData = url.pathname.startsWith("/reader-data/");
  const isCover = /\.(?:png|jpe?g|webp|avif|svg)$/i.test(url.pathname);
  const isStatic = url.pathname.startsWith("/_next/") || isCover;
  if (!isReader && !isReaderData && !isStatic && !OPTIONAL_APP_SHELL.includes(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);
    // Hashed assets and covers are cache-first. Reader HTML and chapter data stay
    // network-first, with a cached copy used only when the request is offline.
    if (cached && isStatic) return cached;
    try {
      const response = await fetch(event.request);
      if ((response.status === 404 || response.status === 410) && (isReader || isReaderData)) {
        await purgeWithdrawnUrl(event.request);
      }
      if (response.ok) {
        try { event.waitUntil(cache.put(event.request, response.clone()).catch(() => undefined)); } catch { /* The online response remains usable if caching is unavailable. */ }
      }
      return response;
    } catch {
      if (cached) return markOfflineFallback(cached);
      if (isReaderData) return new Response(JSON.stringify({ error: "Chapter data is unavailable offline." }), { status: 503, headers: { "content-type": "application/json; charset=utf-8" } });
      const offlinePage = await cache.match("/offline");
      return offlinePage ? markOfflineFallback(offlinePage) : new Response("You are offline. Reconnect to open this page, or use a chapter already saved on this device.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
    }
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "CACHE_READER_URLS" && Array.isArray(event.data.urls)) {
    event.waitUntil(caches.open(CACHE_NAME).then(async (cache) => {
      const urls = Array.from(new Set(event.data.urls.filter((value) => typeof value === "string" && value.startsWith("/") && !value.startsWith("//"))));
      const results = await Promise.all(urls.map(async (path) => {
        try {
          const url = new URL(path, self.location.origin);
          if (url.origin !== self.location.origin) return false;
          const previouslyCached = await cache.match(url.href);
          const response = await fetch(url.href);
          if (!response.ok) {
            if ((response.status === 404 || response.status === 410) && (url.pathname.startsWith("/read/") || url.pathname.startsWith("/reader-data/"))) {
              await purgeWithdrawnUrl(new Request(url.href));
            }
            return Boolean(previouslyCached);
          }
          await cache.put(url.href, response.clone());
          return true;
        } catch {
          try { return Boolean(await cache.match(new URL(path, self.location.origin).href)); } catch { return false; }
        }
      }));
      const cached = results.filter(Boolean).length;
      event.ports?.[0]?.postMessage({ cached, failed: results.length - cached });
    }));
    return;
  }

  if (event.data?.type === "PRUNE_READER_BOOK") {
    const slug = typeof event.data.bookSlug === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(event.data.bookSlug) ? event.data.bookSlug : null;
    const numbers = Array.isArray(event.data.keepNumbers)
      ? event.data.keepNumbers.map(Number).filter((number) => Number.isSafeInteger(number) && number > 0)
      : null;
    if (!slug || !numbers) return;
    event.waitUntil(Promise.all([
      removeBookCache(slug, new Set(numbers)),
      removeOfflineRecords(slug, { keepNumbers: new Set(numbers) }),
    ]).then(([_, removedRecords]) => {
      event.ports?.[0]?.postMessage({ removedRecords });
    }));
  }
});
