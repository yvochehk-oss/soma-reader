import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  assertPublishableChapters,
  inferAuthor,
  inferTitle,
  isExcludedManuscriptPath,
  manuscriptScore,
} from "../soma-manuscript-compat.mjs";

const SCRIPT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function manuscript(title, language, count = 2) {
  const heading = language === "en" ? "Chapter" : "Sura ya";
  return `# ${title}\n\n${Array.from({ length: count }, (_, index) => `# ${heading} ${index + 1}: Part ${index + 1}\n\nBody ${index + 1}.`).join("\n\n")}`;
}

test("mobile prefix never becomes part of a title or slug source", () => {
  assert.equal(inferTitle("#\n\n# Chapter 1: An Opening\n\nText", "mobile_The_Book_final_en.md"), "The Book");
  assert.equal(inferTitle("#\n\n# Sura ya 1: Moto\n\nText", "mobile_Kitabu_final_sw.md"), "Kitabu");
});

test("title inference only considers headings before chapter one", () => {
  const source = "#\n\n# Chapter 1: First Chapter\n\nText\n\n# Appendix That Is Not The Title";
  assert.equal(inferTitle(source, "Actual_Title_final_en.md"), "Actual Title");
});

test("author inference reads explicit and heading bylines before chapter one", () => {
  assert.equal(inferAuthor("# A Book\n\n*Author: Layla Pendo*\n\n# Chapter 1: Start\n\nText"), "Layla Pendo");
  assert.equal(inferAuthor("# Kitabu\n\n*Mwandishi: Layla Pendo*\n\n# Sura ya 1: Mwanzo\n\nText"), "Layla Pendo");
  assert.equal(inferAuthor("# A Book\n\n## Safiya Amani\n\n# Sura ya 1: Mwanzo\n\nText"), "Safiya Amani");
});

test("glued chapter headings block publication instead of producing one chapter", () => {
  const source = "# Sura ya 1: Mwanzo\n\nText.# Sura ya 2: Mwisho\n\nText.";
  assert.throws(() => assertPublishableChapters(source, "broken.md"), /glued to prose on line\(s\) 3/);
});

test("backup, quarantine, reports and formatter work directories are excluded", () => {
  for (const path of [
    "/book/09_s2_backup_2026/file_final_en.md",
    "/book/00_隔离_禁止发布/file_final_sw.md",
    "/book/06_reports/report.md",
    "/book/.title_final_en.mobile_work/packets/packet.md",
    "/book/mobile_title_final_en_work/packets/packet.md",
  ]) assert.equal(isExcludedManuscriptPath(path), true, path);
  assert.equal(manuscriptScore("/book/09_s2_backup_2026/mobile_title_final_en.md"), -Infinity);
});

test("root scan treats direct manuscripts independently and pairs nested languages", () => {
  const root = mkdtempSync(join(tmpdir(), "soma-upload-test-"));
  try {
    writeFileSync(join(root, "mobile_Root_Story_final_sw.md"), manuscript("Root Story", "sw"));
    const project = join(root, "Pair_complete_project");
    mkdirSync(join(project, "04_english"), { recursive: true });
    mkdirSync(join(project, "03_swahili"), { recursive: true });
    writeFileSync(join(project, "04_english", "mobile_English_Title_final_en.md"), manuscript("English Title", "en"));
    writeFileSync(join(project, "03_swahili", "mobile_Kichwa_final_sw.md"), manuscript("Kichwa", "sw"));
    writeFileSync(join(project, "manifest.json"), JSON.stringify({ title_en: "Manifest English Title", title_sw: "Kichwa cha Manifest", author: "Amani Test" }));
    const blocked = join(root, "成品小说", "00_隔离_禁止发布", "bad");
    mkdirSync(blocked, { recursive: true });
    writeFileSync(join(blocked, "mobile_Bad_final_en.md"), manuscript("Bad", "en"));
    const auditPath = join(root, "audit.json");
    const output = execFileSync(process.execPath, [join(SCRIPT_DIR, "upload-soma-books.mjs"), root, "--dry-run", "--audit-out", auditPath], {
      encoding: "utf8",
      env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test" },
    });
    const audit = JSON.parse(readFileSync(auditPath, "utf8"));
    assert.equal(audit.totals.books, 3);
    assert.deepEqual(new Set(audit.books.map((book) => book.slug)), new Set(["root-story-sw", "manifest-english-title", "kichwa-cha-manifest-sw"]));
    assert.ok(!audit.books.some((book) => book.slug.startsWith("mobile-")));
    assert.match(output, /Prepared 3 book\(s\), 6 chapter\(s\)/);
    assert.match(output, /Dry run complete; nothing was uploaded/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("automatic build does not silently fall back when the preferred mobile manuscript is malformed", () => {
  const root = mkdtempSync(join(tmpdir(), "soma-build-test-"));
  try {
    writeFileSync(join(root, "Story_final_en.md"), manuscript("Story", "en"));
    writeFileSync(join(root, "mobile_Story_final_en.md"), "# Story\n\n# Chapter 1: One\n\nBody.# Chapter 2: Two\n\nBody.");
    assert.throws(() => execFileSync(process.execPath, [join(SCRIPT_DIR, "build-soma-import.mjs"), root, "--language", "en", "--out", join(root, "out.json")], { encoding: "utf8", stdio: "pipe" }), /Command failed/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
