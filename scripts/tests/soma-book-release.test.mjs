import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import http from "node:http";
import test from "node:test";

import { inspectPublishedBooks, verifyDatabaseBooks } from "../release-soma-books.mjs";

const expected = [{
  slug: "nairobi-after-rain",
  title: "Nairobi After Rain",
  author: "Amina Test",
  language: "en",
  category: "Contemporary",
  tags: ["Friendship", "Nairobi"],
  descriptionLength: 20,
  coverUploaded: true,
  status: "published",
  chapters: 2,
  translationOfSlug: null,
}];

test("database release verification accepts matching published state", () => {
  const actual = [{
    slug: "nairobi-after-rain",
    title: "Nairobi After Rain",
    author_name: "Amina Test",
    language_code: "en",
    category: "Contemporary",
    tags: ["Nairobi", "Friendship"],
    description: "x".repeat(20),
    cover_url: "https://example.test/cover.jpg?v=123",
    status: "published",
    total_chapters: 2,
    actualChapters: 2,
    publishedChapters: 2,
    parentSlug: null,
  }];
  assert.deepEqual(verifyDatabaseBooks(expected, actual), []);
});

test("database release verification reports chapter, cover and pairing drift", () => {
  const actual = [{
    slug: "nairobi-after-rain",
    title: "Nairobi After Rain",
    author_name: "Amina Test",
    language_code: "en",
    category: "Contemporary",
    tags: ["Friendship", "Nairobi"],
    description: "x".repeat(20),
    cover_url: "https://example.test/cover.jpg",
    status: "published",
    total_chapters: 2,
    actualChapters: 1,
    publishedChapters: 1,
    parentSlug: "wrong-parent",
  }];
  const errors = verifyDatabaseBooks(expected, actual).join("\n");
  assert.match(errors, /actual chapter rows/);
  assert.match(errors, /not versioned/);
  assert.match(errors, /translation pairing mismatch/);
});

test("release verification uses the token-protected audit endpoint", async () => {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    assert.equal(request.headers.authorization, "Bearer protected-test-token");
    assert.deepEqual(url.searchParams.getAll("slug"), ["nairobi-after-rain"]);
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, books: [{ slug: "nairobi-after-rain" }], missingSlugs: [] }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  try {
    const books = await inspectPublishedBooks(expected, `http://127.0.0.1:${address.port}/api/internal/book-import`, "protected-test-token");
    assert.deepEqual(books, [{ slug: "nairobi-after-rain" }]);
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("release dry-run exercises the production metadata gate without uploading or deploying", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "soma-release-dry-run-"));
  try {
    const folder = join(temporary, "book");
    const auditPath = join(temporary, "release.json");
    await mkdir(folder);
    await writeFile(join(folder, "story_meta.json"), JSON.stringify({
      title: "Dry Run Story",
      author: "Test Author",
      language: "en",
      description: "A complete synopsis used only to validate the release entrypoint.",
      category: "Contemporary",
      tags: ["Test Fiction"],
    }));
    await writeFile(join(folder, "mobile_Dry_Run_Story_final_en.md"), "# Dry Run Story\n\n# Chapter 1: Start\n\nNothing is uploaded by this test.\n");
    await writeFile(join(folder, "cover_en.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    const result = await new Promise((resolvePromise, reject) => {
      const child = spawn(process.execPath, ["scripts/release-soma-books.mjs", folder, "--publish", "--deploy", "--dry-run", "--audit-out", auditPath], {
        cwd: process.cwd(),
        env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test" },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = ""; let stderr = "";
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
      child.once("error", reject);
      child.once("close", (code) => resolvePromise({ code, stdout, stderr }));
    });
    assert.equal(result.code, 0, result.stderr || result.stdout);
    const audit = JSON.parse(await readFile(auditPath, "utf8"));
    assert.equal(audit.status, "validated-only");
    assert.deepEqual(audit.steps.map((step) => step.name), ["source-and-metadata-preflight"]);
    assert.equal(audit.books[0].status, "published");
    assert.equal(audit.steps[0].result.upload.status, "skipped-dry-run");
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("low-level upload audit preserves partial batch progress on failure", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "soma-partial-upload-"));
  const auditPath = join(temporary, "upload.json");
  await writeFile(join(temporary, "First_Story_final_en.md"), "# First Story\n\n# Chapter 1: Start\n\nFirst.\n");
  await writeFile(join(temporary, "Second_Story_final_en.md"), "# Second Story\n\n# Chapter 1: Start\n\nSecond.\n");
  await writeFile(join(temporary, "cover_en.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  let imports = 0;
  const server = http.createServer((request, response) => {
    if (request.url?.startsWith("/rest/v1/books")) {
      response.writeHead(200, { "content-type": "application/json" }).end("[]");
      return;
    }
    if (request.url === "/api" && request.method === "POST") {
      imports += 1;
      response.writeHead(imports === 1 ? 200 : 400, { "content-type": "application/json" });
      response.end(JSON.stringify(imports === 1 ? { importedBooks: 1, importedChapters: 1 } : { error: "Permanent test failure" }));
      return;
    }
    response.writeHead(404).end();
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  try {
    const result = await new Promise((resolvePromise, reject) => {
      const child = spawn(process.execPath, [
        "scripts/upload-soma-books.mjs", temporary,
        "--publish", "--author", "Test Author", "--category", "Contemporary", "--tags", "Test Fiction",
        "--description", "A complete synopsis used to test partial upload auditing.", "--batch-size", "1",
        "--api-url", `http://127.0.0.1:${address.port}/api`, "--audit-out", auditPath,
      ], {
        cwd: process.cwd(),
        env: { ...process.env, SOMA_IMPORT_TOKEN: "test", NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${address.port}`, NEXT_PUBLIC_SUPABASE_ANON_KEY: "test" },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = ""; let stderr = "";
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
      child.once("error", reject);
      child.once("close", (code) => resolvePromise({ code, stdout, stderr }));
    });
    assert.notEqual(result.code, 0);
    const audit = JSON.parse(await readFile(auditPath, "utf8"));
    assert.equal(audit.upload.status, "failed");
    assert.equal(audit.upload.uploadedBooks, 1);
    assert.equal(audit.upload.uploadedChapters, 1);
    assert.deepEqual(audit.upload.batches[0].slugs, ["first-story"]);
  } finally {
    server.close();
    await once(server, "close");
    await rm(temporary, { recursive: true, force: true });
  }
});
