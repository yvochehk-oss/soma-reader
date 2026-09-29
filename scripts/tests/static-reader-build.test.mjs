import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildReaderArtifacts,
  renderStaticReaderPage,
  staticReaderHtmlRelativePath,
} from "../lib/static-reader.mjs";

const book = {
  id: "book-1",
  slug: "river-story",
  title: "River Story",
  author_name: "A. Writer",
  language_code: "en",
};

const chapters = [
  { id: "chapter-1", chapter_number: 1, title: "The Crossing", content: "The river was quiet.\n\nMara stepped forward." },
  { id: "chapter-2", chapter_number: 2, title: "The Return", content: "At dawn, the water changed." },
];

test("static reader page files use Cloudflare's extensionless .html layout", () => {
  assert.equal(staticReaderHtmlRelativePath("river-story", 1), "river-story/1.html");
  assert.equal(staticReaderHtmlRelativePath("river-story", "2"), "river-story/2.html");
  assert.throws(() => staticReaderHtmlRelativePath("../outside", 1), /Invalid published book slug/);
  assert.throws(() => staticReaderHtmlRelativePath("river-story", 0), /invalid chapter number/);
});

test("static chapter HTML keeps the slashless canonical URL and adjacent chapter links", () => {
  const html = renderStaticReaderPage({
    book,
    chapter: chapters[0],
    previousChapter: undefined,
    nextChapter: chapters[1],
  });

  assert.match(html, /<link rel="canonical" href="https:\/\/somanovel\.uk\/read\/river-story\/1">/);
  assert.match(html, /href="\/read\/river-story\/2" data-reader-turn-link="next"/);
  assert.match(html, /<article class="reader-body" data-reader-content><p>The river was quiet\.<\/p>\s*<p>Mara stepped forward\.<\/p><\/article>/);
  assert.doesNotMatch(html, /self\.__next_f\.push|__next_f/);
});

test("reader manifest URLs remain extensionless while HTML artifacts use .html files", () => {
  const artifacts = buildReaderArtifacts(book, chapters);

  assert.deepEqual(artifacts.manifest.chapters.map(({ url }) => url), [
    "/reader-data/river-story/1.json",
    "/reader-data/river-story/2.json",
  ]);
  assert.equal(staticReaderHtmlRelativePath(book.slug, artifacts.chapters[0].chapter_number), "river-story/1.html");
  assert.equal(staticReaderHtmlRelativePath(book.slug, artifacts.chapters[1].chapter_number), "river-story/2.html");
});

test("Cloudflare serves extensionless chapter URLs asset-first and worker misses never fall back to SSR", async () => {
  const [wrangler, mergeScript] = await Promise.all([
    readFile(new URL("../../wrangler.jsonc", import.meta.url), "utf8"),
    readFile(new URL("../merge-vite-into-open-next.mjs", import.meta.url), "utf8"),
  ]);

  assert.match(wrangler, /"html_handling"\s*:\s*"auto-trailing-slash"/);
  assert.match(wrangler, /"run_worker_first"\s*:\s*false/);
  assert.match(wrangler, /"not_found_handling"\s*:\s*"none"/);
  assert.ok(mergeScript.includes('readerAssetUrl.pathname = readerPath + ".html";'));
  assert.ok(mergeScript.includes('return new Response("Not Found", { status: 404 });'));
});
