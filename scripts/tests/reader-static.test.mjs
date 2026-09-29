import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../../public/reader-static.js", import.meta.url), "utf8");
const requests = [];
const storage = new Map();
const browser = {
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
  },
  crypto: { randomUUID: () => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
  navigator: { onLine: true },
  fetch: (url, options) => { requests.push({ url, options }); return Promise.resolve({ ok: true }); },
};
vm.runInNewContext(source, { window: browser, URL, Date, encodeURIComponent, btoa: (value) => Buffer.from(value, "binary").toString("base64") });
const reader = browser.SomaReaderStatic;

test("reader JSON validation accepts the documented schema and rejects mismatched chapters", () => {
  const payload = {
    schemaVersion: 1,
    book: { slug: "river-story", title: "River Story", author: "A. Writer", language: "en" },
    chapter: { id: "chapter-2", number: 2, title: "The Crossing", content: "First paragraph.\n\nSecond paragraph.", paragraphs: ["First paragraph.", "Second paragraph."] },
  };
  assert.equal(reader.normalizeChapter(payload, "river-story", 2).content, "First paragraph.\n\nSecond paragraph.");
  assert.equal(reader.normalizeChapter(payload, "other-story", 2), null);
  assert.equal(reader.normalizeChapter(payload, "river-story", 3), null);
  assert.equal(reader.normalizeChapter({ ...payload, schemaVersion: 2 }, "river-story", 2), null);
});

test("manifest only accepts same-book static chapter-data URLs and unique chapter numbers", () => {
  const manifest = reader.normalizeManifest({
    schemaVersion: 1,
    book: { slug: "river-story", totalChapters: 4 },
    chapters: [
      { number: 3, title: "Three", url: "/reader-data/river-story/3.json" },
      { number: 1, title: "One", url: "/reader-data/river-story/1.json" },
      { number: 2, title: "External", url: "https://attacker.invalid/reader-data/river-story/2.json" },
      { number: 1, title: "Duplicate", url: "/reader-data/river-story/1.json" },
      { number: 4, title: "Wrong book", url: "/reader-data/other-story/4.json" },
    ],
  }, "river-story", "https://somanovel.uk/read/river-story/1");

  assert.deepEqual(Array.from(manifest.chapters, ({ number }) => number), [1, 3]);
  assert.deepEqual(Array.from(reader.selectChapters(manifest, 1, 1), ({ number }) => number), [1]);
  assert.deepEqual(Array.from(reader.selectChapters(manifest, 2, 10), ({ number }) => number), [3]);
  assert.equal(reader.normalizeManifest({ schemaVersion: 1, book: { slug: "other" }, chapters: [] }, "river-story", "https://somanovel.uk/"), null);
});

test("manifest reconciliation is authoritative only when every declared chapter is present once", () => {
  const chapter = (number) => ({ number, url: `/reader-data/river-story/${number}.json` });
  const complete = reader.normalizeManifest({
    schemaVersion: 1, book: { slug: "river-story", totalChapters: 3 }, chapters: [chapter(1), chapter(2), chapter(3)],
  }, "river-story", "https://somanovel.uk/");
  const incomplete = reader.normalizeManifest({
    schemaVersion: 1, book: { slug: "river-story", totalChapters: 3 }, chapters: [chapter(1), chapter(1), chapter(3)],
  }, "river-story", "https://somanovel.uk/");

  assert.equal(complete.complete, true);
  assert.equal(incomplete.complete, false);
});

test("URL validation rejects cross-origin URLs and optional prefixes constrain chapter data", () => {
  const base = "https://somanovel.uk/read/river-story/1";
  assert.equal(reader.safeLocalUrl("/reader-data/river-story/2.json", base, "/reader-data/river-story/"), "/reader-data/river-story/2.json");
  assert.equal(reader.safeLocalUrl("https://elsewhere.test/file", base), null);
  assert.equal(reader.safeLocalUrl("/reader-data/other/2.json", base, "/reader-data/river-story/"), null);
  assert.equal(reader.safeLocalUrl("//elsewhere.test/file", base), null);
});

test("offline record encoding stays compatible with the current Soma library format", () => {
  const encrypted = reader.encryptOfflineContent("Hello, dunia!", "river-story");
  assert.equal(typeof encrypted, "string");
  assert.notEqual(encrypted, "Hello, dunia!");
  const encoded = Buffer.from(encrypted, "base64").toString("binary");
  let hash = 0;
  const seed = "river-story-soma-reader-secure-key-2026";
  for (let index = 0; index < seed.length; index += 1) { hash = (hash << 5) - hash + seed.charCodeAt(index); hash |= 0; }
  const key = Math.abs(hash) % 255;
  const uri = Array.from(encoded, (char) => String.fromCharCode(char.charCodeAt(0) ^ key)).join("");
  assert.equal(decodeURIComponent(uri), "Hello, dunia!");
});

test("reader analytics preserve the API payload and reject IDs the server cannot accept", () => {
  requests.length = 0;
  const bookId = "11111111-1111-4111-8111-111111111111";
  const chapterId = "22222222-2222-4222-8222-222222222222";
  storage.set("soma-anonymous-id", "not-a-uuid");
  assert.equal(reader.trackEvent({ eventType: "chapter_start", bookId, chapterId }), true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "/api/events");
  assert.equal(requests[0].options.keepalive, true);
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    eventType: "chapter_start", bookId, chapterId, anonymousId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  });
  assert.equal(storage.get("soma-anonymous-id"), "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");

  assert.equal(reader.trackEvent({ eventType: "chapter_start", bookId: "fixture-book", chapterId }), false);
  assert.equal(reader.trackEvent({ eventType: "not-an-event", bookId, chapterId }), false);
  assert.equal(requests.length, 1);
});

test("reader progress uses the authenticated progress endpoint only while online", () => {
  requests.length = 0;
  const bookId = "11111111-1111-4111-8111-111111111111";
  const chapterId = "22222222-2222-4222-8222-222222222222";
  assert.equal(reader.trackProgress({ bookId, chapterId, chapterNumber: 3, scrollPercent: 47 }), true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "/api/progress");
  assert.equal(requests[0].options.keepalive, true);
  assert.deepEqual(JSON.parse(requests[0].options.body), { bookId, chapterId, chapterNumber: 3, scrollPercent: 47 });

  browser.navigator.onLine = false;
  assert.equal(reader.trackProgress({ bookId, chapterId, chapterNumber: 3, scrollPercent: 48 }), false);
  assert.equal(requests.length, 1);
});
