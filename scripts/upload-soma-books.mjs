#!/usr/bin/env node

import { execFile, execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { inferLanguage, manuscriptScore, parseChapters } from "./soma-manuscript-compat.mjs";

const execFileAsync = promisify(execFile);
const BATCH_SIZE = 20;

// ── Supabase pre-flight: fetch existing slugs to avoid duplicate uploads ──
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://uamaohjbrjervzsjxwyg.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_bLhT1CNl-DrFn_wz6gmp6A_fJPGBY2G";

async function fetchExistingSlugs() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/books?select=slug&limit=1000`, {
      headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (!res.ok) { console.warn(`⚠️  Could not fetch existing slugs (${res.status}), proceeding without pre-check.`); return new Set(); }
    const rows = await res.json();
    return new Set(rows.map((r) => r.slug));
  } catch {
    console.warn("⚠️  Supabase pre-check failed (network error), proceeding without pre-check.");
    return new Set();
  }
}

function usage() {
  console.error("Usage: node scripts/upload-soma-books.mjs <books-folder> [--author name] [--category category] [--publish] [--dry-run]");
  process.exit(1);
}

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  const ascii = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return ascii || `soma-story-${Date.now()}`;
}

async function collectFiles(folder) {
  const entries = await readdir(folder, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory() ? collectFiles(join(folder, entry.name)) : [join(folder, entry.name)]));
  return nested.flat();
}

async function collectBookSources(root) {
  const files = await collectFiles(root);
  const standardFolders = [...new Set(files.filter((path) => basename(path) === "story_meta.json").map(dirname))];
  const sources = standardFolders.map((folder) => ({ folder, manuscript: null, language: null, group: null, legacy: false }));
  const coveredByStandard = (path) => standardFolders.some((folder) => path === folder || path.startsWith(`${folder}${sep}`));
  const legacyFiles = files.filter((path) => !coveredByStandard(path) && manuscriptScore(basename(path)) > -Infinity);
  const relativeParts = legacyFiles.map((path) => relative(root, path).split(sep));
  const structural = /^(?:\d+[_ -]|english|swahili|kiswahili|manuscripts?|covers?)/i;
  const hasDirectManuscript = relativeParts.some((parts) => parts.length === 1);
  const topChildren = new Set(relativeParts.filter((parts) => parts.length > 1).map((parts) => parts[0]));
  const archiveMode = !hasDirectManuscript && [...topChildren].some((name) => !structural.test(name));
  const projects = new Map();
  for (const path of legacyFiles) {
    const rel = relative(root, path).split(sep);
    const project = archiveMode ? join(root, rel[0]) : root;
    projects.set(project, [...(projects.get(project) ?? []), path]);
  }
  for (const [project, paths] of projects) {
    const candidates = [];
    for (const path of paths) {
      const markdown = await readFile(path, "utf8");
      const language = inferLanguage(markdown, basename(path));
      if (!language || !parseChapters(markdown).length) continue;
      candidates.push({ path, language, score: manuscriptScore(basename(path)) });
    }
    for (const language of ["en", "sw"]) {
      const selected = candidates.filter((candidate) => candidate.language === language).sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))[0];
      if (selected) sources.push({ folder: project, manuscript: selected.path, language, group: slugify(basename(project).replace(/_v\d+(?:_\d+)*(?:-\d+)?(?:_project)?$/i, "")), legacy: true });
    }
  }
  return sources;
}

const rootArg = process.argv[2];
if (!rootArg || rootArg.startsWith("--")) usage();

const root = resolve(rootArg);
const sources = await collectBookSources(root);
if (!sources.length) throw new Error("No standard book folders or compatible completed manuscripts were found.");

const temp = await mkdtemp(join(tmpdir(), "soma-import-"));
try {
  const prepared = [];
  for (const [index, source] of sources.entries()) {
    const { folder, manuscript, language, legacy } = source;
    const output = join(temp, `${index}.json`);
    const args = ["scripts/build-soma-import.mjs", folder, "--out", output, "--author", option("--author", "Soma Originals"), "--category", option("--category", "thriller"), "--description", option("--description", "A captivating bilingual story from Kenya.")];
    if (manuscript) args.push("--manuscript", manuscript);
    if (language) args.push("--language", language);
    if (process.argv.includes("--publish")) args.push("--publish");
    await execFileAsync(process.execPath, args);
    const payload = JSON.parse(await readFile(output, "utf8"));
    const metadata = legacy ? {} : JSON.parse(await readFile(join(folder, "story_meta.json"), "utf8"));
    const originalTitle = String(metadata.title_original ?? metadata.title ?? payload.books[0].title);
    const explicitParent = String(metadata.translation_of_slug ?? metadata.translationOfSlug ?? "").trim();
    prepared.push({ book: payload.books[0], group: source.group ?? slugify(originalTitle), originalSlug: slugify(originalTitle), explicitParent, allowOriginalFallback: !legacy && Boolean(metadata.title_original) });
  }

  const groups = new Map();
  for (const item of prepared) groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
  for (const group of groups.values()) {
    const rootItem = group.find((item) => item.book.language === "en") ?? group[0];
    if (new Set(group.map((item) => item.book.language)).size !== group.length) throw new Error(`More than one version has the same language for “${rootItem.book.title}”.`);
    for (const item of group) {
      if (item !== rootItem) item.book.translationOfSlug = rootItem.book.slug;
      else if (item.explicitParent) item.book.translationOfSlug = slugify(item.explicitParent);
      else if (item.allowOriginalFallback && item.book.language === "sw" && item.originalSlug !== item.book.slug.replace(/-sw$/, "")) item.book.translationOfSlug = item.originalSlug;
    }
  }
  const allBooks = prepared.map((item) => item.book);
  const allChapters = allBooks.reduce((sum, book) => sum + book.chapters.length, 0);
  console.log(`Prepared ${allBooks.length} book(s), ${allChapters} chapter(s).`);

  if (process.argv.includes("--dry-run")) {
    console.log("Dry run complete; nothing was uploaded.");
  } else {
    // ── Pre-flight: check which slugs already exist in Supabase ──
    const existingSlugs = await fetchExistingSlugs();
    const newBooks = allBooks.filter((book) => {
      if (existingSlugs.has(book.slug)) {
        console.log(`⏭  Skipped (already in DB): ${book.title} [${book.language}] (slug: ${book.slug})`);
        return false;
      }
      return true;
    });

    if (!newBooks.length) {
      console.log("✅ All books already exist in the database. Nothing to upload.");
    } else {
      console.log(`🆕 ${newBooks.length} new book(s) to upload (${existingSlugs.size} already in DB).`);
      let token = process.env.SOMA_IMPORT_TOKEN || "";
      if (!token) {
        try {
          token = execFileSync("security", ["find-generic-password", "-s", "Soma Book Import Token", "-w"], { encoding: "utf8" }).trim();
        } catch {
          token = "";
        }
      }
      if (!token) throw new Error("No import token found.");
      const apiUrl = option("--api-url", "https://read.20140128.xyz/api/internal/book-import");
      let uploadedBooks = 0;
      let uploadedChapters = 0;
      for (let start = 0; start < newBooks.length; start += BATCH_SIZE) {
        const batch = newBooks.slice(start, start + BATCH_SIZE);
        const response = await fetch(apiUrl, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ books: batch }) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(`Batch ${start / BATCH_SIZE + 1} failed (${response.status}): ${result.error ?? "Unknown error"}`);
        uploadedBooks += result.importedBooks;
        uploadedChapters += result.importedChapters;
        console.log(`Uploaded batch ${start / BATCH_SIZE + 1}: ${result.importedBooks} book(s), ${result.importedChapters} chapter(s).`);
      }
      console.log(`Completed: ${uploadedBooks} book(s), ${uploadedChapters} chapter(s).`);
    }
  }
} finally {
  await rm(temp, { recursive: true, force: true });
}
