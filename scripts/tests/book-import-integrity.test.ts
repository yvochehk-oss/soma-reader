import assert from "node:assert/strict";
import test from "node:test";

import { importBooks, validateClassicIntegrity, type ClassicIntegrityInput } from "../../app/lib/book-import";

const SHA = "a".repeat(64);

function integrityFor(contents: string[], overrides: Partial<ClassicIntegrityInput> = {}): ClassicIntegrityInput {
  const counts = contents.map((content) => content.trim().split(/\s+/).filter(Boolean).length);
  const total = counts.reduce((sum, count) => sum + count, 0);
  return {
    verified: true,
    sourceCanonicalSha256: SHA,
    reconstructedCanonicalSha256: SHA,
    sourceWordCount: total,
    reconstructedWordCount: total,
    coverageRatio: 1,
    minChapterWordCount: Math.min(...counts),
    maxChapterWordCount: Math.max(...counts),
    suspiciousShortChapterCount: 0,
    sourceStartFingerprint: "start-fingerprint",
    reconstructedStartFingerprint: "start-fingerprint",
    sourceEndFingerprint: "end-fingerprint",
    reconstructedEndFingerprint: "end-fingerprint",
    ...overrides,
  };
}

test("does not apply the classics gate to modern fiction", () => {
  assert.equal(validateClassicIntegrity({ title: "Modern", tags: ["Contemporary"], chapters: [{ title: "Chapter 1", content: "No!" }] }), null);
});

test("published imports require the canonical site taxonomy and tags", async () => {
  const base = {
    slug: "modern-book",
    title: "Modern Book",
    author: "Author",
    language: "en",
    description: "A complete synopsis.",
    coverUrl: "/covers/modern.jpg",
    status: "published",
    chapters: [{ number: 1, title: "Chapter 1", content: "Text", status: "published" }],
  };
  await assert.rejects(importBooks({} as never, { books: [{ ...base, category: "other", tags: ["Fiction"] }] }), /canonical category/);
  await assert.rejects(importBooks({} as never, { books: [{ ...base, category: "Contemporary", tags: [] }] }), /at least one tag/);
});

test("full imports persist a versioned URL for newly uploaded covers", async () => {
  const calls: Array<{ table: string; operation: string; values?: unknown }> = [];
  const client = {
    storage: {
      from() {
        return {
          async upload() { return { error: null }; },
          getPublicUrl() { return { data: { publicUrl: "https://example.test/storage/v1/object/public/covers/imports/versioned/cover.jpg" } }; },
        };
      },
    },
    from(table: string) {
      if (table === "books") return {
        upsert(values: unknown) {
          calls.push({ table, operation: "upsert", values });
          return { async select() { return { data: [{ id: "book-1", slug: "versioned", title: "Versioned" }], error: null }; } };
        },
        update(values: unknown) {
          calls.push({ table, operation: "update", values });
          return { async eq() { return { error: null }; } };
        },
      };
      if (table === "chapters") return {
        async upsert(values: unknown) { calls.push({ table, operation: "upsert", values }); return { error: null }; },
        delete() { return { eq() { return { async not() { return { error: null }; } }; } }; },
      };
      throw new Error(`Unexpected table ${table}`);
    },
  };
  await importBooks(client as never, { books: [{
    slug: "versioned",
    title: "Versioned",
    author: "Author",
    language: "en",
    category: "Contemporary",
    tags: ["Literary Fiction"],
    description: "A complete synopsis.",
    coverDataUrl: "data:image/jpeg;base64,/9j/2Q==",
    status: "published",
    chapters: [{ number: 1, title: "Chapter 1", content: "Text", status: "published" }],
  }] });
  const bookUpsert = calls.find((call) => call.table === "books" && call.operation === "upsert")?.values as Array<{ cover_url: string }>;
  assert.match(bookUpsert[0].cover_url, /cover\.jpg\?v=\d+$/);
});

test("requires integrity evidence for English Classics", () => {
  assert.match(validateClassicIntegrity({ title: "Classic", tags: ["English Classics"], chapters: [{ title: "Chapter 1", content: "Text" }] }) ?? "", /must include integrity metadata/);
});

test("allows a legitimate one-word classic chapter", () => {
  const chapters = [{ title: "A Pivotal Answer", content: "No!" }];
  assert.equal(validateClassicIntegrity({ title: "Classic", tags: ["English Classics"], chapters, integrity: integrityFor(chapters.map((chapter) => chapter.content)) }), null);
});

test("rejects a short table-of-contents page-number section", () => {
  const chapters = [{ title: "— I —", content: "[ 1 ] [ 2 ] [ 3 ]" }];
  assert.match(validateClassicIntegrity({ title: "Classic", tags: ["English Classics"], chapters, integrity: integrityFor(chapters.map((chapter) => chapter.content)) }) ?? "", /suspicious-short-chapter metadata/);
});

test("rejects loss of source words even when the caller says it is verified", () => {
  const chapters = [{ title: "Chapter 1", content: "one two three" }];
  assert.match(validateClassicIntegrity({
    title: "Classic",
    tags: ["English Classics"],
    chapters,
    integrity: integrityFor(chapters.map((chapter) => chapter.content), { sourceWordCount: 4, coverageRatio: 0.75 }),
  }) ?? "", /preserve 100%/);
});

test("rejects an anomalously long classic chapter", () => {
  const content = Array.from({ length: 50_001 }, () => "word").join(" ");
  const chapters = [{ title: "Chapter 1", content }];
  assert.match(validateClassicIntegrity({ title: "Classic", tags: ["English Classics"], chapters, integrity: integrityFor([content]) }) ?? "", /longer than 50,000 words/);
});

test("rejects mismatched canonical hashes and endpoint fingerprints", () => {
  const chapters = [{ title: "Chapter 1", content: "one two three" }];
  assert.match(validateClassicIntegrity({
    title: "Classic",
    tags: ["English Classics"],
    chapters,
    integrity: integrityFor([chapters[0].content], { reconstructedCanonicalSha256: "b".repeat(64) }),
  }) ?? "", /SHA-256/);
  assert.match(validateClassicIntegrity({
    title: "Classic",
    tags: ["English Classics"],
    chapters,
    integrity: integrityFor([chapters[0].content], { reconstructedEndFingerprint: "different" }),
  }) ?? "", /fingerprint/);
});

function chaptersOnlyPayload() {
  const contents = ["one two three", "four five six seven"];
  return {
    updateMode: "chapters-only",
    books: [{
      slug: "existing-classic",
      title: "Payload Title Must Not Win",
      author: "Payload Author Must Not Win",
      language: "en",
      category: "Payload Category Must Not Win",
      description: "Payload description must not win.",
      coverDataUrl: "not-even-a-valid-cover",
      tags: ["Payload Tag Must Not Win"],
      status: "draft",
      featured: false,
      chapters: contents.map((content, index) => ({ number: index + 1, title: `Chapter ${index + 1}`, content, status: "published", isFree: true })),
      integrity: integrityFor(contents),
    }],
  };
}

function chaptersOnlySupabase(existingBooks = [{
  id: "book-1",
  slug: "existing-classic",
  title: "Existing Classic",
  tags: ["English Classics"],
  status: "published" as const,
  published_at: "2026-01-02T03:04:05.000Z",
}]) {
  const calls: Array<{ table: string; operation: string; values?: unknown; filters?: unknown[] }> = [];
  const client = {
    storage: { from() { throw new Error("chapters-only must not access storage"); } },
    from(table: string) {
      if (table === "books") return {
        select() {
          return { in: async (_field: string, values: unknown[]) => {
            calls.push({ table, operation: "select", values });
            return { data: existingBooks, error: null };
          } };
        },
        upsert() { throw new Error("chapters-only must not upsert book metadata"); },
        update(values: unknown) {
          return {
            in: async (...filters: unknown[]) => {
              calls.push({ table, operation: "update-in", values, filters });
              return { error: null };
            },
            eq: async (...filters: unknown[]) => {
              calls.push({ table, operation: "update-eq", values, filters });
              return { error: null };
            },
          };
        },
      };
      if (table === "chapters") return {
        async upsert(values: unknown) {
          calls.push({ table, operation: "upsert", values });
          return { error: null };
        },
        delete() {
          return {
            eq(...equalFilter: unknown[]) {
              return { not: async (...notFilter: unknown[]) => {
                calls.push({ table, operation: "delete", filters: [equalFilter, notFilter] });
                return { error: null };
              } };
            },
          };
        },
      };
      throw new Error(`Unexpected table ${table}`);
    },
  };
  return { client, calls };
}

test("chapters-only preserves all metadata and removes stale chapters", async () => {
  const { client, calls } = chaptersOnlySupabase();
  const result = await importBooks(client as never, chaptersOnlyPayload());
  assert.equal(result.importedChapters, 2);
  assert.equal(calls.some((call) => call.table === "books" && call.operation === "upsert"), false);
  assert.deepEqual(calls.find((call) => call.operation === "delete")?.filters, [["book_id", "book-1"], ["chapter_number", "in", "(1,2)"]]);
  const bookUpdates = calls.filter((call) => call.table === "books" && call.operation.startsWith("update-"));
  assert.deepEqual(bookUpdates.map((call) => call.values), [{ total_chapters: 2 }]);
});

test("chapters-only refuses to create a missing slug before changing data", async () => {
  const { client, calls } = chaptersOnlySupabase([]);
  await assert.rejects(importBooks(client as never, chaptersOnlyPayload()), /existing books only.*existing-classic/);
  assert.deepEqual(calls.map((call) => call.operation), ["select"]);
});
