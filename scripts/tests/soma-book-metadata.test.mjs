import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { assertPublicationMetadata, normalizeCategory, normalizeTags } from "../lib/soma-book-metadata.mjs";
import { validateCliOptions } from "../lib/soma-cli.mjs";

const execFileAsync = promisify(execFile);

test("normalizes only the supported site taxonomy and deduplicates tags", () => {
  assert.equal(normalizeCategory("urban_fantasy"), "Urban Fantasy");
  assert.equal(normalizeCategory("science fiction"), "Sci-Fi");
  assert.equal(normalizeCategory("uncategorized"), "");
  assert.deepEqual(normalizeTags(["Mystery", " mystery ", "East Africa"]), ["Mystery", "East Africa"]);
});

test("CLI validation rejects typos, duplicate flags and missing values", () => {
  const contract = { valueFlags: ["--category"], booleanFlags: ["--publish"] };
  assert.throws(() => validateCliOptions(["--catgory", "Romance"], contract), /Unknown option/);
  assert.throws(() => validateCliOptions(["--category", "--publish"], contract), /requires a value/);
  assert.throws(() => validateCliOptions(["--publish", "--publish"], contract), /only once/);
});

test("published metadata requires a canonical category and specific tags", () => {
  const base = { title: "A Book", author: "An Author", description: "A real synopsis.", language: "en", coverUrl: "/covers/a.jpg" };
  assert.throws(() => assertPublicationMetadata({ ...base, category: "Other", tags: ["Fiction"] }, "A Book"), /category must be one of/);
  assert.throws(() => assertPublicationMetadata({ ...base, category: "Romance", tags: [] }, "A Book"), /at least one specific tag/);
});

test("build-soma-import reads category and tags from story_meta.json", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "soma-meta-test-"));
  try {
    const folder = join(temporary, "book");
    await mkdir(folder);
    await writeFile(join(folder, "story_meta.json"), JSON.stringify({
      title: "Nairobi After Rain",
      author: "Amina Test",
      language: "en",
      description: "Two old friends confront a promise that changed both of their lives.",
      category: "Contemporary",
      tags: ["Friendship", "Nairobi"],
    }));
    await writeFile(join(folder, "mobile_Nairobi_After_Rain_final_en.md"), "# Nairobi After Rain\n\n# Chapter 1: Home\n\nThe rain stopped. The city waited.\n");
    await writeFile(join(folder, "cover_en.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    const output = join(temporary, "payload.json");
    await execFileAsync(process.execPath, ["scripts/build-soma-import.mjs", folder, "--publish", "--out", output], { cwd: process.cwd() });
    const payload = JSON.parse(await readFile(output, "utf8"));
    assert.equal(payload.books[0].category, "Contemporary");
    assert.deepEqual(payload.books[0].tags, ["Friendship", "Nairobi"]);
    assert.equal(payload.books[0].status, "published");
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("build-soma-import refuses malformed story_meta.json", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "soma-invalid-meta-test-"));
  try {
    await writeFile(join(temporary, "story_meta.json"), "{not valid json");
    await writeFile(join(temporary, "Story_final_en.md"), "# Story\n\n# Chapter 1: Start\n\nText.\n");
    await assert.rejects(execFileAsync(process.execPath, ["scripts/build-soma-import.mjs", temporary, "--out", join(temporary, "payload.json")], { cwd: process.cwd() }), /Command failed/);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
