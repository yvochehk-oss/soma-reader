(function (global) {
  "use strict";

  const CONSENT_KEY = "soma-ads-consent";
  const CONSENT_EVENT = "soma-ads-consent-changed";
  const PUBLISHER_ID = "ca-pub-6785168010810140";
  const AD_SLOT_ID = "6476924726";
  const PREFERENCES_KEY = "soma-reader-settings";
  const DB_NAME = "soma-offline";
  const STORE_NAME = "chapters";
  const DEFAULTS = { fontSize: 20, lineHeight: 1.95, theme: "sepia" };
  const ANONYMOUS_ID_KEY = "soma-anonymous-id";
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const READER_EVENT_TYPES = new Set(["chapter_start", "chapter_25", "chapter_50", "chapter_75", "chapter_complete", "offline_download"]);
  const COPY = {
    en: {
      settings: "Reading settings", decrease: "Decrease text size", increase: "Increase text size",
      lineSpacing: "Line spacing", theme: "Theme", light: "Light", sepia: "Sepia", dark: "Dark",
      fullscreen: "Full screen", exitFullscreen: "Exit full screen", fullscreenUnavailable: "Full screen is not available in this browser.",
      download: "Download current", next10: "Download next 10", next20: "Download next 20", downloading: "Downloading…",
      consentTitle: "Cookie settings", consentCopy: "We use necessary storage for reading features. With your permission, Google AdSense may use advertising cookies to show and measure ads. Read our",
      cookiePolicy: "Cookie Policy", reject: "Reject non-essential", accept: "Accept advertising cookies", cookieSettings: "Cookie settings",
      currentSaved: "Current chapter saved for offline reading.", readyBoth: "Current and next chapters saved for offline reading.",
      currentOnly: "Current chapter saved. The next chapter could not be saved.", currentFailed: "This chapter could not be saved for offline reading.",
      preparing: "Saving this chapter for offline reading…", cachePartial: " Chapter text was saved, but some offline reader files could not be cached.",
      downloadedAll: "Saved {saved} of {available} available chapters for offline reading.",
      downloadedPartial: "Saved {saved} of {available} chapters. Could not save: {failed}.",
      downloadedNone: "Could not save any chapters. Check your connection and device storage.", noChapters: "No chapters are available to download.",
      pageProgress: "Reading progress", previousPage: "Previous page", nextPage: "Next page", openSettings: "Open reading settings",
    },
    sw: {
      settings: "Mipangilio ya kusoma", decrease: "Punguza ukubwa wa maandishi", increase: "Ongeza ukubwa wa maandishi",
      lineSpacing: "Nafasi za mistari", theme: "Mandhari", light: "Nyeupe", sepia: "Krimu", dark: "Giza",
      fullscreen: "Skrini nzima", exitFullscreen: "Ondoka skrini nzima", fullscreenUnavailable: "Skrini nzima haipatikani kwenye kivinjari hiki.",
      download: "Pakua sura hii", next10: "Pakua sura 10 zijazo", next20: "Pakua sura 20 zijazo", downloading: "Inapakua…",
      consentTitle: "Mipangilio ya vidakuzi", consentCopy: "Tunatumia hifadhi muhimu kwa vipengele vya kusoma. Ukikubali, Google AdSense inaweza kutumia vidakuzi vya matangazo ili kuonyesha na kupima matangazo. Soma",
      cookiePolicy: "Sera ya Vidakuzi", reject: "Kataa visivyo muhimu", accept: "Kubali vidakuzi vya matangazo", cookieSettings: "Mipangilio ya vidakuzi",
      currentSaved: "Sura hii imehifadhiwa kwa kusoma bila mtandao.", readyBoth: "Sura hii na inayofuata zimehifadhiwa kwa kusoma bila mtandao.",
      currentOnly: "Sura hii imehifadhiwa. Sura inayofuata haikuweza kuhifadhiwa.", currentFailed: "Sura hii haikuweza kuhifadhiwa kwa kusoma bila mtandao.",
      preparing: "Inahifadhi sura hii kwa kusoma bila mtandao…", cachePartial: " Maandishi yamehifadhiwa, lakini baadhi ya faili za kusoma bila mtandao hazikuhifadhiwa.",
      downloadedAll: "Sura {saved} kati ya {available} zilizopo zimehifadhiwa kwa kusoma bila mtandao.",
      downloadedPartial: "Sura {saved} kati ya {available} zimehifadhiwa. Zilizoshindikana: {failed}.",
      downloadedNone: "Hakuna sura iliyoweza kuhifadhiwa. Angalia muunganisho na nafasi ya kifaa.", noChapters: "Hakuna sura za kupakua.",
      pageProgress: "Maendeleo ya kusoma", previousPage: "Ukurasa uliotangulia", nextPage: "Ukurasa unaofuata", openSettings: "Fungua mipangilio ya kusoma",
    },
  };

  function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  function isUuid(value) {
    return typeof value === "string" && UUID_PATTERN.test(value);
  }

  function anonymousId() {
    try {
      const stored = global.localStorage.getItem(ANONYMOUS_ID_KEY);
      if (isUuid(stored)) return stored;
      if (!global.crypto || typeof global.crypto.randomUUID !== "function") return null;
      const generated = global.crypto.randomUUID();
      if (!isUuid(generated)) return null;
      global.localStorage.setItem(ANONYMOUS_ID_KEY, generated);
      return generated;
    } catch {
      return null;
    }
  }

  function postJson(path, payload) {
    try {
      if (typeof global.fetch !== "function") return;
      // Analytics/progress are best-effort side effects. Never await them in the
      // reader flow; keepalive lets the browser finish small requests on exit.
      const request = global.fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      });
      if (request && typeof request.catch === "function") void request.catch(() => undefined);
    } catch {
      // Network and storage failures must never interrupt reading.
    }
  }

  function trackEvent(input) {
    if (!input || !READER_EVENT_TYPES.has(input.eventType) || !isUuid(input.bookId) || !isUuid(input.chapterId)) return false;
    const id = anonymousId();
    if (!id) return false;
    const payload = { eventType: input.eventType, bookId: input.bookId, chapterId: input.chapterId, anonymousId: id };
    if (Number.isInteger(input.readingSeconds) && input.readingSeconds >= 0 && input.readingSeconds <= 86400) payload.readingSeconds = input.readingSeconds;
    postJson("/api/events", payload);
    return true;
  }

  function trackProgress(input) {
    if (!input || !isUuid(input.bookId) || (input.chapterId != null && !isUuid(input.chapterId))) return false;
    if (!global.navigator || !global.navigator.onLine) return false;
    postJson("/api/progress", {
      bookId: input.bookId,
      chapterId: input.chapterId || null,
      chapterNumber: input.chapterNumber,
      scrollPercent: input.scrollPercent,
    });
    return true;
  }

  function safeLocalUrl(value, baseUrl, requiredPrefix) {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
      const url = new URL(value, baseUrl);
      if (url.origin !== new URL(baseUrl).origin || !url.pathname.startsWith("/") || url.pathname.includes("\\")) return null;
      if (requiredPrefix && !url.pathname.startsWith(requiredPrefix)) return null;
      return `${url.pathname}${url.search}`;
    } catch {
      return null;
    }
  }

  function normalizeChapter(payload, expectedSlug, expectedNumber) {
    if (!isRecord(payload) || payload.schemaVersion !== 1 || !isRecord(payload.book) || !isRecord(payload.chapter)) return null;
    const book = payload.book;
    const chapter = payload.chapter;
    const number = Number(chapter.number);
    if (book.slug !== expectedSlug || !Number.isSafeInteger(number) || number < 1 || (expectedNumber && number !== expectedNumber)) return null;
    const paragraphs = Array.isArray(chapter.paragraphs)
      ? chapter.paragraphs.filter((paragraph) => typeof paragraph === "string" && paragraph.trim())
      : (typeof chapter.content === "string" ? chapter.content.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean) : []);
    if (!paragraphs.length) return null;
    return {
      key: `${expectedSlug}:${number}`,
      bookSlug: expectedSlug,
      chapterNumber: number,
      id: typeof chapter.id === "string" ? chapter.id : undefined,
      title: typeof chapter.title === "string" && chapter.title.trim() ? chapter.title : `Chapter ${number}`,
      content: paragraphs.join("\n\n"),
      downloadedAt: new Date().toISOString(),
    };
  }

  function normalizeManifest(payload, expectedSlug, baseUrl) {
    if (!isRecord(payload) || payload.schemaVersion !== 1 || !isRecord(payload.book) || payload.book.slug !== expectedSlug || !Array.isArray(payload.chapters)) return null;
    const encodedSlug = encodeURIComponent(expectedSlug);
    const prefix = `/read/${encodedSlug}/`;
    const chapters = payload.chapters.flatMap((item) => {
      if (!isRecord(item)) return [];
      const number = Number(item.number);
      const url = safeLocalUrl(item.url, baseUrl, prefix);
      if (!Number.isSafeInteger(number) || number < 1 || !url || !url.endsWith(`/${number}`)) return [];
      return [{ id: typeof item.id === "string" ? item.id : undefined, number, title: typeof item.title === "string" ? item.title : `Chapter ${number}`, url, wordCount: Number(item.wordCount) || undefined }];
    }).sort((a, b) => a.number - b.number);
    const unique = chapters.filter((item, index) => index === 0 || chapters[index - 1].number !== item.number);
    const declaredTotal = Number(payload.book.totalChapters);
    return {
      book: payload.book,
      chapters: unique,
      // Reconcile old offline copies only when the manifest is complete.
      // A partial or malformed manifest must never delete saved chapters.
      complete: Number.isSafeInteger(declaredTotal) && declaredTotal >= 0 && declaredTotal === unique.length,
    };
  }

  function selectChapters(manifest, currentNumber, count) {
    if (!manifest || !Array.isArray(manifest.chapters)) return [];
    return manifest.chapters.filter((chapter) => chapter.number >= currentNumber).slice(0, count);
  }

  function getCipherKey(bookSlug) {
    let hash = 0;
    const value = `${bookSlug}-soma-reader-secure-key-2026`;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function encryptOfflineContent(content, bookSlug) {
    const encoded = encodeURIComponent(content);
    const key = getCipherKey(bookSlug) % 255;
    let binary = "";
    for (let i = 0; i < encoded.length; i += 1) binary += String.fromCharCode(encoded.charCodeAt(i) ^ key);
    return btoa(binary);
  }

  // Expose deterministic, side-effect-free helpers for the Node tests and diagnostics.
  global.SomaReaderStatic = { normalizeChapter, normalizeManifest, selectChapters, safeLocalUrl, encryptOfflineContent, isUuid, trackEvent, trackProgress };

  if (!global.document || !global.document.querySelector) return;

  function readJson(key) {
    try {
      const value = global.localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  }

  function writeJson(key, value) {
    try { global.localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  }

  function clamp(value, fallback, min, max) {
    if (value == null || value === "") return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function textFor(language) {
    return COPY[language === "sw" ? "sw" : "en"];
  }

  function createElement(tag, className, text) {
    const element = global.document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
  }

  function button(label, attributes) {
    const element = createElement("button", "", label);
    element.type = "button";
    Object.entries(attributes || {}).forEach(([name, value]) => element.setAttribute(name, value));
    return element;
  }

  function ensureReaderUi(reader, copy) {
    let panel = reader.querySelector("[data-reader-controls]");
    if (!panel) {
      panel = createElement("section", "reader-controls");
      panel.setAttribute("data-reader-controls", "");
      panel.setAttribute("aria-label", copy.settings);
      panel.hidden = true;
      const fontGroup = createElement("div", "reader-control-group");
      fontGroup.append(createElement("span", "", copy.settings), button("A−", { "data-reader-font-decrease": "", "aria-label": copy.decrease }), button("A+", { "data-reader-font-increase": "", "aria-label": copy.increase }));
      const spacingGroup = createElement("div", "reader-control-group");
      spacingGroup.append(createElement("span", "", copy.lineSpacing), button("1.95", { "data-reader-line-height": "", "aria-label": copy.lineSpacing }));
      const themeGroup = createElement("div", "reader-control-group");
      themeGroup.appendChild(createElement("span", "", copy.theme));
      [["light", copy.light], ["sepia", copy.sepia], ["dark", copy.dark]].forEach(([value, label]) => themeGroup.appendChild(button(label, { "data-reader-theme": value })));
      const actions = createElement("div", "reader-control-group");
      actions.append(button(copy.fullscreen, { "data-reader-fullscreen": "" }), button(copy.download, { "data-reader-download": "1" }), button(copy.next10, { "data-reader-download": "10" }), button(copy.next20, { "data-reader-download": "20" }));
      const note = createElement("p", "reader-control-note");
      note.setAttribute("data-reader-status", "");
      note.setAttribute("role", "status");
      panel.append(fontGroup, spacingGroup, themeGroup, actions, note);
      reader.appendChild(panel);
    }

    let toggle = reader.querySelector("[data-reader-settings-toggle]");
    if (!toggle) {
      toggle = button("Aa", { "data-reader-settings-toggle": "", "aria-label": copy.openSettings });
      toggle.className = "reader-settings";
      reader.appendChild(toggle);
    }

    let toolbar = reader.querySelector("[data-reader-toolbar], .reader-mobile-toolbar");
    if (!toolbar) {
      toolbar = createElement("div", "reader-mobile-toolbar");
      toolbar.setAttribute("data-reader-toolbar", "");
      const previous = button("‹", { "data-reader-turn": "previous", "aria-label": copy.previousPage });
      const progressLabel = createElement("label", "reader-progress");
      const progressText = createElement("span", "", "0%");
      progressText.setAttribute("data-reader-progress-text", "");
      const progress = global.document.createElement("input");
      progress.type = "range"; progress.min = "0"; progress.max = "100"; progress.value = "0";
      progress.setAttribute("data-reader-progress", ""); progress.setAttribute("aria-label", copy.pageProgress);
      progressLabel.append(progressText, progress);
      const next = button("›", { "data-reader-turn": "next", "aria-label": copy.nextPage });
      const settings = button("Aa", { "data-reader-settings-toggle": "", "aria-label": copy.openSettings });
      toolbar.append(previous, progressLabel, next, settings);
      reader.appendChild(toolbar);
    }
    toolbar.setAttribute("data-reader-toolbar", "");
    const progressInput = toolbar.querySelector("[data-reader-progress]") || toolbar.querySelector('input[type="range"]');
    if (progressInput) progressInput.setAttribute("data-reader-progress", "");
    const progressText = toolbar.querySelector("[data-reader-progress-text]") || toolbar.querySelector(".reader-progress span");
    if (progressText) progressText.setAttribute("data-reader-progress-text", "");
    if (!panel.querySelector("[data-reader-fullscreen]")) {
      const actionGroup = panel.querySelector(".reader-control-group:last-of-type") || panel;
      actionGroup.insertBefore(button(copy.fullscreen, { "data-reader-fullscreen": "" }), actionGroup.firstChild);
    }
    if (!panel.querySelector("[data-reader-status]")) {
      const note = createElement("p", "reader-control-note");
      note.setAttribute("data-reader-status", ""); note.setAttribute("role", "status"); panel.appendChild(note);
    }
    return { panel, toggle, toolbar, note: panel.querySelector("[data-reader-status]") };
  }

  function db() {
    return new Promise((resolve, reject) => {
      if (!global.indexedDB) { reject(new Error("IndexedDB unavailable")); return; }
      const request = global.indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not open offline storage"));
    });
  }

  async function saveDownloadedChapter(chapter) {
    const database = await db();
    try {
      const record = { ...chapter, content: encryptOfflineContent(chapter.content, chapter.bookSlug) };
      await new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).put(record);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error || new Error("Could not save chapter"));
        transaction.onabort = () => reject(transaction.error || new Error("Chapter save was cancelled"));
      });
    } finally { database.close(); }
  }

  async function fetchJson(path) {
    const response = await global.fetch(path, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    return response.json();
  }

  async function reconcileOfflineBook(bookSlug, manifest) {
    if (!manifest.complete) return;
    const keepNumbers = new Set(manifest.chapters.map((chapter) => chapter.number));
    const encodedSlug = encodeURIComponent(bookSlug);

    try {
      if (global.caches) {
        const cacheNames = await global.caches.keys();
        for (const cacheName of cacheNames) {
          const cache = await global.caches.open(cacheName);
          const requests = await cache.keys();
          await Promise.all(requests.map(async (request) => {
            const pathname = new URL(request.url).pathname;
            const pagePrefix = `/read/${encodedSlug}/`;
            const pageMatch = pathname.startsWith(pagePrefix) ? pathname.slice(pagePrefix.length).match(/^(\d+)\/?$/) : null;
            const number = Number(pageMatch?.[1]);
            if (pageMatch && !keepNumbers.has(number)) await cache.delete(request);
          }));
        }
      }
    } catch { /* Cache cleanup must never interrupt online reading. */ }

    try {
      const database = await db();
      try {
        await new Promise((resolve, reject) => {
          const transaction = database.transaction(STORE_NAME, "readwrite");
          const store = transaction.objectStore(STORE_NAME);
          const keys = store.getAllKeys();
          keys.onsuccess = () => {
            const prefix = `${bookSlug}:`;
            for (const key of keys.result) {
              if (typeof key !== "string" || !key.startsWith(prefix)) continue;
              const number = Number(key.slice(prefix.length));
              if (!keepNumbers.has(number)) store.delete(key);
            }
          };
          keys.onerror = () => reject(keys.error || new Error("Could not inspect saved chapters"));
          transaction.oncomplete = resolve;
          transaction.onerror = () => reject(transaction.error || new Error("Could not reconcile saved chapters"));
          transaction.onabort = () => reject(transaction.error || new Error("Saved chapter reconciliation was cancelled"));
        });
      } finally { database.close(); }
    } catch { /* Offline storage cleanup must never interrupt online reading. */ }
  }

  async function loadManifest(reader) {
    const url = safeLocalUrl(reader.dataset.manifestUrl || reader.dataset.readerManifestUrl, global.location.href);
    if (!url) throw new Error("Chapter manifest URL is missing or invalid");
    const response = await global.fetch(url, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    const payload = await response.json();
    const manifest = normalizeManifest(payload, reader.dataset.bookSlug, global.location.href);
    if (!manifest) throw new Error("Chapter manifest format is invalid");
    // A network-fetched, complete manifest is authoritative for this book. When
    // a chapter was withdrawn, remove its previously downloaded text and pages.
    // An offline fallback manifest is deliberately not authoritative.
    if (manifest.complete && response.headers.get("x-soma-reader-cache") !== "offline") {
      await reconcileOfflineBook(reader.dataset.bookSlug, manifest);
    }
    return manifest;
  }

  async function getChapter(reader, entry) {
    const slug = reader.dataset.bookSlug;
    const prefix = `/read/${encodeURIComponent(slug)}/`;
    const url = safeLocalUrl(entry.url, global.location.href, prefix);
    if (!url) throw new Error(`Chapter ${entry.number} has an invalid page URL`);
    const response = await global.fetch(url, { headers: { accept: "text/html" } });
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    const html = await response.text();
    const doc = typeof global.DOMParser !== "undefined"
      ? new global.DOMParser().parseFromString(html, "text/html")
      : null;
    const chapter = doc ? normalizeChapter(currentFromHtml(doc.querySelector("[data-reader]")), slug, entry.number) : null;
    if (!chapter) throw new Error(`Chapter ${entry.number} HTML could not be parsed`);
    return { chapter, url };
  }

  function pagePath(slug, number) {
    return `/read/${encodeURIComponent(slug)}/${number}`;
  }

  async function cacheReaderUrls(urls) {
    const safe = Array.from(new Set(urls.map((url) => safeLocalUrl(url, global.location.href)).filter(Boolean)));
    if (!safe.length || !global.navigator.serviceWorker) return { cached: 0, failed: safe.length };
    try {
      const registration = await global.navigator.serviceWorker.register("/sw.js");
      const worker = global.navigator.serviceWorker.controller || registration.active || registration.waiting || registration.installing;
      if (!worker) return { cached: 0, failed: safe.length };
      const channel = new MessageChannel();
      const result = await new Promise((resolve) => {
        const timer = global.setTimeout(() => resolve(null), 20000);
        channel.port1.onmessage = (event) => { global.clearTimeout(timer); resolve(event.data); };
        worker.postMessage({ type: "CACHE_READER_URLS", urls: safe }, [channel.port2]);
      });
      return result && Number.isFinite(result.cached) ? result : { cached: 0, failed: safe.length };
    } catch {
      return { cached: 0, failed: safe.length };
    }
  }

  function setNote(noteElement, value) {
    if (noteElement) noteElement.textContent = value;
  }

  function interpolate(template, values) {
    return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
  }

  function currentFromHtml(reader) {
    const content = reader.querySelector("[data-reader-content]");
    const paragraphs = content ? Array.from(content.querySelectorAll("p")).map((paragraph) => paragraph.textContent.trim()).filter(Boolean) : [];
    if (!paragraphs.length) return null;
    const number = Number(reader.dataset.chapterNumber);
    return {
      key: `${reader.dataset.bookSlug}:${number}`,
      bookSlug: reader.dataset.bookSlug,
      chapterNumber: number,
      id: reader.dataset.chapterId || undefined,
      title: reader.dataset.chapterTitle || (reader.querySelector("h1") && reader.querySelector("h1").textContent.trim()) || `Chapter ${number}`,
      content: paragraphs.join("\n\n"),
      downloadedAt: new Date().toISOString(),
    };
  }

  function loadConsent() {
    try { return global.localStorage.getItem(CONSENT_KEY); } catch { return null; }
  }

  function ensureAdsScript() {
    if (global.document.querySelector("script[data-soma-adsense]")) return;
    const script = global.document.createElement("script");
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${PUBLISHER_ID}&autoAds=true`;
    script.crossOrigin = "anonymous";
    script.setAttribute("data-soma-adsense", "true");
    global.document.head.appendChild(script);
  }

  function pushAds() {
    global.document.querySelectorAll(`ins.adsbygoogle[data-ad-client="${PUBLISHER_ID}"]:not([data-soma-pushed])`).forEach((unit) => {
      try {
        (global.adsbygoogle = global.adsbygoogle || []).push({});
        unit.setAttribute("data-soma-pushed", "true");
      } catch { /* Ads must never interrupt reading. */ }
    });
  }

  function initConsent(reader, copy) {
    const section = reader.querySelector("[data-reader-consent]") || global.document.querySelector("[data-reader-consent]");
    if (!section) return;
    const accept = section.querySelector("[data-reader-consent-accept]");
    const reject = section.querySelector("[data-reader-consent-reject]");
    const settings = global.document.querySelector("[data-reader-consent-settings]") || createElement("button", "reader-cookie-settings", copy.cookieSettings);
    settings.type = "button";
    settings.setAttribute("data-reader-consent-settings", "");
    if (!settings.isConnected) global.document.body.appendChild(settings);

    function setOpen(open) {
      section.hidden = !open;
      settings.hidden = open;
    }
    function choose(value) {
      try { global.localStorage.setItem(CONSENT_KEY, value); } catch { /* Keep this explicit choice for the current page only. */ }
      setOpen(false);
      global.dispatchEvent(new Event(CONSENT_EVENT));
      if (value === "accepted") { ensureAdsScript(); pushAds(); }
    }
    if (accept) accept.addEventListener("click", () => choose("accepted"));
    if (reject) reject.addEventListener("click", () => choose("rejected"));
    settings.addEventListener("click", () => setOpen(true));
    global.addEventListener("soma-open-cookie-settings", () => setOpen(true));
    global.addEventListener(CONSENT_EVENT, () => { if (loadConsent() === "accepted") { ensureAdsScript(); pushAds(); } });
    const stored = loadConsent();
    setOpen(stored !== "accepted" && stored !== "rejected");
    settings.hidden = stored !== "accepted" && stored !== "rejected";
    if (stored === "accepted") { ensureAdsScript(); pushAds(); }
  }

  function initReader(reader) {
    if (reader.dataset.readerInitialized === "true") return;
    reader.dataset.readerInitialized = "true";
    reader.classList.add("reader-page", "reader-static-page");
    const slug = reader.dataset.bookSlug || "";
    const chapterNumber = Number(reader.dataset.chapterNumber);
    if (!slug || !Number.isSafeInteger(chapterNumber) || chapterNumber < 1) return;
    const copy = textFor(reader.dataset.language);
    const ui = ensureReaderUi(reader, copy);
    const pageTop = reader.querySelector("[data-reader-top]") || reader.querySelector(".reader-top");
    const preferencesValue = readJson(PREFERENCES_KEY);
    const preferences = {
      fontSize: clamp(preferencesValue && preferencesValue.fontSize, DEFAULTS.fontSize, 17, 25),
      lineHeight: clamp(preferencesValue && preferencesValue.lineHeight, DEFAULTS.lineHeight, 1.5, 2.2),
      theme: preferencesValue && ["light", "sepia", "dark"].includes(preferencesValue.theme) ? preferencesValue.theme : DEFAULTS.theme,
    };
    let scrollPercent = 0;
    let scrollFrame = 0;
    let progressTimer = 0;
    let serverProgressTimer = 0;
    let isDownloading = false;
    const reachedEvents = new Set();
    const readingStartedAt = Date.now();
    const bookId = reader.dataset.bookId || "";
    const chapterId = reader.dataset.chapterId || "";
    const startPath = `${global.location.pathname}${global.location.search}`;
    const progressKey = `soma-progress:${slug}`;

    trackEvent({ eventType: "chapter_start", bookId, chapterId });

    function updatePreferences() {
      reader.style.setProperty("--reader-size", `${preferences.fontSize}px`);
      reader.style.setProperty("--reader-line-height", String(preferences.lineHeight));
      reader.classList.remove("reader-theme-light", "reader-theme-sepia", "reader-theme-dark");
      reader.classList.add(`reader-theme-${preferences.theme}`);
      ui.panel.querySelectorAll("[data-reader-theme]").forEach((item) => item.classList.toggle("active", item.dataset.readerTheme === preferences.theme));
      const spacing = ui.panel.querySelector("[data-reader-line-height]");
      if (spacing) spacing.textContent = preferences.lineHeight.toFixed(2);
      writeJson(PREFERENCES_KEY, preferences);
    }

    function setMenu(open) {
      reader.classList.toggle("reader-menu-open", open);
      ui.panel.hidden = !open;
      reader.querySelectorAll("[data-reader-settings-toggle]").forEach((item) => item.setAttribute("aria-expanded", String(open)));
      if (pageTop) pageTop.setAttribute("aria-hidden", String(!open));
    }

    function turnPage(direction) {
      global.scrollBy({ top: (direction === "next" ? 1 : -1) * Math.round(global.innerHeight * 0.82), behavior: "smooth" });
    }

    function seekTo(percent) {
      const maxScroll = Math.max(0, global.document.documentElement.scrollHeight - global.innerHeight);
      global.scrollTo({ top: maxScroll * Number(percent) / 100, behavior: "smooth" });
    }

    function updateProgress() {
      const max = Math.max(1, global.document.documentElement.scrollHeight - global.innerHeight);
      scrollPercent = Math.min(100, Math.max(0, Math.round(global.scrollY / max * 100)));
      const input = reader.querySelector("[data-reader-progress]");
      const text = reader.querySelector("[data-reader-progress-text]");
      if (input) input.value = String(scrollPercent);
      if (text) text.textContent = `${String(chapterNumber).padStart(2, "0")} · ${scrollPercent}%`;
      if (progressTimer) global.clearTimeout(progressTimer);
      progressTimer = global.setTimeout(() => {
        writeJson(progressKey, { chapterNumber, scrollPercent, updatedAt: new Date().toISOString() });
        progressTimer = 0;
      }, 500);
      const checkpoints = [[25, "chapter_25"], [50, "chapter_50"], [75, "chapter_75"], [98, "chapter_complete"]];
      for (const [limit, eventType] of checkpoints) {
        if (scrollPercent >= limit && !reachedEvents.has(eventType)) {
          reachedEvents.add(eventType);
          trackEvent({ eventType, bookId, chapterId, readingSeconds: Math.max(1, Math.round((Date.now() - readingStartedAt) / 1000)) });
        }
      }
      if (global.navigator && global.navigator.onLine && isUuid(bookId) && !serverProgressTimer) {
        serverProgressTimer = global.setTimeout(() => {
          serverProgressTimer = 0;
          trackProgress({ bookId, chapterId: isUuid(chapterId) ? chapterId : null, chapterNumber, scrollPercent });
        }, 12000);
      }
    }

    const storedProgress = readJson(progressKey);
    if (storedProgress && Number(storedProgress.chapterNumber) === chapterNumber) {
      const savedPercent = clamp(storedProgress.scrollPercent, 0, 0, 100);
      if (savedPercent > 0) global.setTimeout(() => {
        const max = Math.max(0, global.document.documentElement.scrollHeight - global.innerHeight);
        global.scrollTo({ top: max * savedPercent / 100, behavior: "auto" });
        updateProgress();
      }, 180);
    }

    reader.querySelectorAll("[data-reader-settings-toggle]").forEach((item) => item.addEventListener("click", () => setMenu(ui.panel.hidden)));
    reader.querySelectorAll("[data-reader-font-decrease]").forEach((item) => item.addEventListener("click", () => { preferences.fontSize = Math.max(17, preferences.fontSize - 1); updatePreferences(); }));
    reader.querySelectorAll("[data-reader-font-increase]").forEach((item) => item.addEventListener("click", () => { preferences.fontSize = Math.min(25, preferences.fontSize + 1); updatePreferences(); }));
    reader.querySelectorAll("[data-reader-line-height]").forEach((item) => item.addEventListener("click", () => {
      preferences.lineHeight = preferences.lineHeight > 1.9 ? 1.65 : preferences.lineHeight > 1.7 ? 1.8 : 1.95;
      updatePreferences();
    }));
    reader.querySelectorAll("[data-reader-theme]").forEach((item) => item.addEventListener("click", () => {
      if (["light", "sepia", "dark"].includes(item.dataset.readerTheme)) { preferences.theme = item.dataset.readerTheme; updatePreferences(); }
    }));
    reader.querySelectorAll("[data-reader-turn]").forEach((item) => item.addEventListener("click", () => turnPage(item.dataset.readerTurn === "previous" ? "previous" : "next")));
    reader.querySelectorAll("[data-reader-progress]").forEach((item) => item.addEventListener("input", () => seekTo(item.value)));
    reader.querySelectorAll("[data-reader-fullscreen]").forEach((item) => item.addEventListener("click", async () => {
      try {
        if (global.document.fullscreenElement) await global.document.exitFullscreen();
        else if (global.document.documentElement.requestFullscreen) await global.document.documentElement.requestFullscreen();
        else setNote(ui.note, copy.fullscreenUnavailable);
      } catch { setNote(ui.note, copy.fullscreenUnavailable); }
    }));
    global.document.addEventListener("fullscreenchange", () => {
      reader.querySelectorAll("[data-reader-fullscreen]").forEach((item) => { item.textContent = global.document.fullscreenElement ? copy.exitFullscreen : copy.fullscreen; });
    });
    global.addEventListener("scroll", () => {
      if (scrollFrame) return;
      scrollFrame = global.requestAnimationFrame(() => { scrollFrame = 0; updateProgress(); });
    }, { passive: true });
    global.addEventListener("pagehide", () => {
      if (progressTimer) global.clearTimeout(progressTimer);
      writeJson(progressKey, { chapterNumber, scrollPercent, updatedAt: new Date().toISOString() });
    });
    global.document.addEventListener("keydown", (event) => {
      if (event.target && event.target.closest && event.target.closest("input, textarea, select, button")) return;
      if (event.key === "ArrowLeft") { event.preventDefault(); turnPage("previous"); }
      else if (event.key === "ArrowRight" || event.key === " ") { event.preventDefault(); turnPage("next"); }
    });
    reader.addEventListener("click", (event) => {
      if (event.target.closest("a,button,select,input,label,textarea,.reader-ad,.adsbygoogle,[data-reader-controls],[data-reader-toolbar]")) return;
      const width = global.innerWidth;
      if (event.clientX <= width * 0.28) turnPage("previous");
      else if (event.clientX >= width * 0.72) turnPage("next");
      else setMenu(ui.panel.hidden);
    });
    updatePreferences();
    setMenu(false);
    initConsent(reader, copy);

    const currentHtmlChapter = currentFromHtml(reader);
    const manifestPath = safeLocalUrl(reader.dataset.manifestUrl || reader.dataset.readerManifestUrl, global.location.href);
    const cacheUrls = [startPath, "/reader-static.js", "/reader-static.css"];
    if (manifestPath) cacheUrls.push(manifestPath);
    const noteNode = reader.querySelector("[data-offline-status]") || reader.querySelector(".offline-note");
    if (noteNode) noteNode.textContent = copy.preparing;

    (async () => {
      let currentSaved = false;
      let nextSaved = false;
      let nextAvailable = false;
      let nextPage = "";
      try {
        if (currentHtmlChapter) { await saveDownloadedChapter(currentHtmlChapter); currentSaved = true; }
      } catch { currentSaved = false; }
      try {
        const manifest = await loadManifest(reader);
        const nextEntry = manifest.chapters.find((entry) => entry.number > chapterNumber);
        if (nextEntry) {
          nextAvailable = true;
          const result = await getChapter(reader, nextEntry);
          await saveDownloadedChapter(result.chapter);
          nextSaved = true;
          cacheUrls.push(pagePath(slug, nextEntry.number), result.url);
          nextPage = pagePath(slug, nextEntry.number);
        }
      } catch { /* Current chapter remains usable if prefetching is unavailable. */ }
      const cacheResult = await cacheReaderUrls(cacheUrls);
      if (noteNode) {
        const allFilesCached = cacheResult.failed === 0 && cacheResult.cached >= cacheUrls.length;
        const base = currentSaved && nextAvailable && nextSaved && allFilesCached ? copy.readyBoth : currentSaved && nextAvailable && !nextSaved ? copy.currentOnly : currentSaved ? copy.currentSaved : copy.currentFailed;
        noteNode.textContent = currentSaved && !allFilesCached ? `${base}${copy.cachePartial}` : base;
        noteNode.setAttribute("data-offline-saved", String(currentSaved));
      }
      if (nextPage) reader.dataset.nextCachedUrl = nextPage;
    })();

    reader.querySelectorAll("[data-reader-download]").forEach((downloadButton) => downloadButton.addEventListener("click", async () => {
      if (isDownloading) return;
      const count = Number(downloadButton.dataset.readerDownload);
      if (![1, 10, 20].includes(count)) return;
      isDownloading = true;
      const buttons = Array.from(reader.querySelectorAll("[data-reader-download]"));
      buttons.forEach((item) => { item.disabled = true; item.textContent = copy.downloading; });
      setNote(ui.note, copy.downloading);
      try {
        const manifest = await loadManifest(reader);
        const selected = selectChapters(manifest, chapterNumber, count);
        if (!selected.length) { setNote(ui.note, copy.noChapters); return; }
        let saved = 0;
        const failed = [];
        const cacheUrls = [];
        for (const entry of selected) {
          try {
            let chapter;
            let dataUrl;
            if (entry.number === chapterNumber && currentHtmlChapter) {
              chapter = currentHtmlChapter;
              const fetched = await getChapter(reader, entry).catch(() => null);
              if (fetched) { chapter = fetched.chapter; dataUrl = fetched.url; }
            } else {
              const fetched = await getChapter(reader, entry);
              chapter = fetched.chapter;
              dataUrl = fetched.url;
            }
            await saveDownloadedChapter(chapter);
            saved += 1;
            cacheUrls.push(pagePath(slug, entry.number));
            if (dataUrl) cacheUrls.push(dataUrl);
          } catch { failed.push(String(entry.number)); }
        }
        const cacheResult = await cacheReaderUrls(cacheUrls);
        if (saved === selected.length) trackEvent({ eventType: "offline_download", bookId, chapterId });
        if (saved === 0) setNote(ui.note, copy.downloadedNone);
        else if (failed.length) setNote(ui.note, interpolate(copy.downloadedPartial, { saved, available: selected.length, failed: failed.join(", ") }));
        else setNote(ui.note, interpolate(copy.downloadedAll, { saved, available: selected.length }));
        if (cacheResult.failed > 0 && saved > 0) ui.note.textContent += reader.dataset.language === "sw" ? ` Kurasa ${cacheResult.cached} kati ya ${cacheUrls.length} zimehifadhiwa.` : ` ${cacheResult.cached} of ${cacheUrls.length} reader pages were cached.`;
      } catch {
        setNote(ui.note, copy.downloadedNone);
      } finally {
        isDownloading = false;
        buttons.forEach((item) => {
          item.disabled = false;
          const value = Number(item.dataset.readerDownload);
          item.textContent = value === 1 ? copy.download : value === 10 ? copy.next10 : copy.next20;
        });
      }
    }));
  }

  function initAll() {
    global.document.querySelectorAll("[data-reader]").forEach(initReader);
  }

  if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", initAll, { once: true });
  else initAll();
})(typeof window !== "undefined" ? window : globalThis);
