#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { inferLanguage, inferTitle, isExcludedManuscriptPath, manuscriptScore } from "./soma-manuscript-compat.mjs";
import { fetchJsonWithRetry, getImportToken } from "./lib/soma-release-http.mjs";
import { getSupabasePublicConfig } from "./lib/soma-public-config.mjs";
import { validateCliOptions } from "./lib/soma-cli.mjs";

const execFileAsync = promisify(execFile);
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

async function fetchExistingBooks() {
  try {
    const { url, key } = await getSupabasePublicConfig();
    const res = await fetch(`${url}/rest/v1/books?select=slug,title,language_code&limit=1000`, {
      headers: { apikey: key, authorization: `Bearer ${key}` },
    });
    if (!res.ok) { console.warn(`⚠️  Could not fetch existing books (${res.status}); audit actions will be marked unknown.`); return { books: new Map(), available: false }; }
    const rows = await res.json();
    return { books: new Map(rows.map((row) => [row.slug, row])), available: true };
  } catch {
    console.warn("⚠️  Supabase pre-check failed (network error); audit actions will be marked unknown.");
    return { books: new Map(), available: false };
  }
}

function usage() {
  console.error("Usage: node scripts/upload-soma-books.mjs <books-folder> [--author name] [--category category] [--tags tag1,tag2] [--description text] [--publish|--draft] [--dry-run] [--audit-out file.json] [--batch-size 1] [--api-url URL]");
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
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(folder, entry.name);
    if (isExcludedManuscriptPath(path)) return [];
    return entry.isDirectory() ? collectFiles(path) : [path];
  }));
  return nested.flat();
}

async function optionalJson(path) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return null; }
}

async function legacyMetadata(folder) {
  const candidates = [join(folder, "manifest.json"), join(folder, "06_package", "manifest.json")];
  for (const path of candidates) {
    const value = await optionalJson(path);
    if (!value) continue;
    return {
      author: String(value.author ?? "").trim(),
      titleEn: String(value.title_en ?? value.title?.en ?? "").trim(),
      titleSw: String(value.title_sw ?? value.title?.sw ?? "").trim(),
    };
  }
  return { author: "", titleEn: "", titleSw: "" };
}

const COLLECTION_FOLDER = /^(?:成品小说|正文|finished|completed|books?|novels?|manuscripts?)$/i;

function projectForPath(root, path) {
  const parts = relative(root, path).split(sep);
  if (parts.length === 1) return `file:${parts[0].replace(/\.(?:md|txt)$/i, "").replace(/^mobile[_ -]+/i, "")}`;
  const projectIndex = COLLECTION_FOLDER.test(parts[0]) && parts.length > 2 ? 1 : 0;
  return join(root, ...parts.slice(0, projectIndex + 1));
}

async function collectBookSources(root) {
  const files = await collectFiles(root);
  const standardFolders = [...new Set(files.filter((path) => basename(path) === "story_meta.json").map(dirname))];
  // A standard folder may contain both localized manuscripts beside one
  // story_meta.json (the common Drive export layout).  Treat each language as
  // an independent source instead of handing the mixed folder to
  // build-soma-import, which correctly refuses to guess between EN and SW.
  const standardSources = [];
  for (const folder of standardFolders) {
    const meta = await optionalJson(join(folder, "story_meta.json"));
    const directCandidates = files
      .filter((path) => dirname(path) === folder && manuscriptScore(path) > -Infinity)
      .map(async (path) => {
        const markdown = await readFile(path, "utf8");
        const language = inferLanguage(markdown, basename(path));
        if (!language) return null;
        const metaTitle = meta ? (language === "en" ? (meta.title_en || meta.titleEn) : (meta.title_sw || meta.titleSw)) : "";
        const title = metaTitle || inferTitle(markdown, basename(path));
        return { path, language, title, score: manuscriptScore(basename(path)) };
      });
    const candidates = (await Promise.all(directCandidates)).filter(Boolean);
    const languages = [...new Set(candidates.map((candidate) => candidate.language))];
    if (!languages.length) {
      standardSources.push({ folder, manuscript: null, language: null, group: null, legacy: false });
      continue;
    }
    for (const language of ["en", "sw"]) {
      const selected = candidates
        .filter((candidate) => candidate.language === language)
        .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))[0];
      if (selected) standardSources.push({ folder, manuscript: selected.path, language, title: selected.title, group: null, legacy: false });
    }
  }
  const sources = standardSources;
  const coveredByStandard = (path) => standardFolders.some((folder) => path === folder || path.startsWith(`${folder}${sep}`));
  const legacyFiles = files.filter((path) => !coveredByStandard(path) && manuscriptScore(path) > -Infinity);
  const projects = new Map();
  for (const path of legacyFiles) {
    const project = projectForPath(root, path);
    projects.set(project, [...(projects.get(project) ?? []), path]);
  }
  for (const [project, paths] of projects) {
    const candidates = [];
    for (const path of paths) {
      const markdown = await readFile(path, "utf8");
      const language = inferLanguage(markdown, basename(path));
      if (!language) continue;
      candidates.push({ path, language, score: manuscriptScore(basename(path)) });
    }
    for (const language of ["en", "sw"]) {
      const selected = candidates.filter((candidate) => candidate.language === language).sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))[0];
      if (selected) {
        const folder = project.startsWith("file:") ? root : project;
        const groupName = project.startsWith("file:") ? project.slice(5) : basename(project).replace(/_v\d+(?:_\d+)*(?:-\d+)?(?:_project)?$/i, "");
        const metadata = project.startsWith("file:") ? { author: "", titleEn: "", titleSw: "" } : await legacyMetadata(folder);
        sources.push({ folder, manuscript: selected.path, language, group: slugify(groupName), legacy: true, metadata });
      }
    }
  }
  return sources;
}

const rootArg = process.argv[2];
if (!rootArg || rootArg.startsWith("--")) usage();
validateCliOptions(process.argv.slice(3), {
  valueFlags: ["--author", "--category", "--tags", "--description", "--audit-out", "--batch-size", "--api-url"],
  booleanFlags: ["--publish", "--draft", "--dry-run"],
});

const root = resolve(rootArg);
const publish = process.argv.includes("--publish");
const draft = process.argv.includes("--draft");
const dryRun = process.argv.includes("--dry-run");
if (publish && draft) throw new Error("Choose only one upload mode: --publish or --draft.");
if (!dryRun && !publish && !draft) throw new Error("Uploading requires an explicit --publish or --draft mode. Use --dry-run to inspect without writing.");
const batchSizeValue = Number(option("--batch-size", "1"));
if (!Number.isInteger(batchSizeValue) || batchSizeValue < 1 || batchSizeValue > 20) {
  throw new Error("--batch-size must be an integer between 1 and 20.");
}
// A single 18-chapter book already consumes several Worker subrequests (cover,
// metadata, chapters, stale-chapter cleanup and final publish). Keep the safe
// default at one book per request; larger batches are an explicit operator
// choice for deployments with a higher subrequest limit.
const batchSize = batchSizeValue;
const sources = await collectBookSources(root);
if (!sources.length) throw new Error("No standard book folders or compatible completed manuscripts were found.");

const temp = await mkdtemp(join(tmpdir(), "soma-import-"));
try {
  const prepared = [];
  const failures = [];
  for (const [index, source] of sources.entries()) {
    const { folder, manuscript, language, title: sourceTitle, legacy, metadata = {} } = source;
    const output = join(temp, `${index}.json`);
    const author = metadata.author || option("--author", "");
    const localizedTitle = legacy
      ? language === "en" ? metadata.titleEn : language === "sw" ? metadata.titleSw : ""
      : sourceTitle || "";
    const args = [join(SCRIPT_DIR, "build-soma-import.mjs"), folder, "--out", output];
    for (const flag of ["--category", "--tags", "--description"]) {
      const value = option(flag, "");
      if (value) args.push(flag, value);
    }
    if (author) args.push("--author", author);
    if (manuscript) args.push("--manuscript", manuscript);
    if (language) args.push("--language", language);
    if (localizedTitle) args.push("--title", localizedTitle);
    if (publish) args.push("--publish");
    if (draft) args.push("--draft");
    try {
      await execFileAsync(process.execPath, args);
      const payload = JSON.parse(await readFile(output, "utf8"));
      const metadata = legacy ? {} : JSON.parse(await readFile(join(folder, "story_meta.json"), "utf8"));
      const originalTitle = String(metadata.title_original ?? metadata.title ?? payload.books[0].title);
      const explicitParent = String(metadata.translation_of_slug ?? metadata.translationOfSlug ?? "").trim();
      prepared.push({ book: payload.books[0], source: manuscript ?? folder, group: source.group ?? slugify(originalTitle), originalSlug: slugify(originalTitle), explicitParent, allowOriginalFallback: !legacy && Boolean(metadata.title_original) });
    } catch (error) {
      const rawError = String(error?.stderr || error?.message || error).trim();
      const conciseError = rawError.split("\n").map((line) => line.trim()).find((line) => line.startsWith("Error: "))?.slice(7) || rawError;
      failures.push({ source: manuscript ?? folder, language, error: conciseError });
    }
  }

  if (failures.length) {
    const auditPath = option("--audit-out", "");
    const audit = {
      generatedAt: new Date().toISOString(), root, dryRun,
      books: prepared.map((item) => ({ source: relative(root, item.source), slug: item.book.slug, title: item.book.title, language: item.book.language, chapters: item.book.chapters.length, action: "blocked-by-batch-validation" })),
      failures: failures.map((failure) => ({ ...failure, source: relative(root, failure.source) })),
    };
    if (auditPath) {
      const resolvedAuditPath = resolve(auditPath);
      await mkdir(dirname(resolvedAuditPath), { recursive: true });
      await writeFile(resolvedAuditPath, `${JSON.stringify(audit, null, 2)}\n`);
    }
    for (const failure of failures) console.error(`BLOCKED ${failure.language?.toUpperCase() ?? "?"} ${relative(root, failure.source)}: ${failure.error}`);
    throw new Error(`${failures.length} manuscript(s) failed validation; nothing was uploaded.`);
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
  const duplicateSlugs = [...new Set(allBooks.map((book) => book.slug).filter((slug, index, slugs) => slugs.indexOf(slug) !== index))];
  if (duplicateSlugs.length) throw new Error(`Duplicate target slug(s) from separate sources: ${duplicateSlugs.join(", ")}. Remove duplicate/archive manuscripts or assign explicit metadata before uploading.`);
  const allChapters = allBooks.reduce((sum, book) => sum + book.chapters.length, 0);
  console.log(`Prepared ${allBooks.length} book(s), ${allChapters} chapter(s).`);

  const existingState = await fetchExistingBooks();
  const existingBooks = existingState.books;
  const updates = existingState.available ? allBooks.filter((book) => existingBooks.has(book.slug)).length : null;
  const creates = existingState.available ? allBooks.length - updates : null;
  const audit = {
    generatedAt: new Date().toISOString(), root, dryRun, publish,
    totals: { books: allBooks.length, chapters: allChapters, updates, creates },
    books: prepared.map((item) => ({
      source: relative(root, item.source),
      slug: item.book.slug,
      title: item.book.title,
      author: item.book.author,
      language: item.book.language,
      category: item.book.category,
      tags: item.book.tags ?? [],
      descriptionLength: item.book.description?.length ?? 0,
      hasCover: Boolean(item.book.coverDataUrl || item.book.coverUrl),
      coverUploaded: Boolean(item.book.coverDataUrl),
      status: item.book.status,
      chapters: item.book.chapters.length,
      action: existingState.available ? existingBooks.has(item.book.slug) ? "update" : "create" : "unknown",
      translationOfSlug: item.book.translationOfSlug ?? null,
    })), failures: [],
  };
  for (const item of audit.books) console.log(`${item.action.toUpperCase().padEnd(7)} ${item.language.toUpperCase()} ${item.slug} (${item.chapters} chapters) <- ${item.source}`);
  const auditPath = option("--audit-out", "");
  const persistAudit = async () => {
    if (!auditPath) return;
    const resolvedAuditPath = resolve(auditPath);
    await mkdir(dirname(resolvedAuditPath), { recursive: true });
    await writeFile(resolvedAuditPath, `${JSON.stringify(audit, null, 2)}\n`);
  };
  if (auditPath) {
    await persistAudit();
    console.log(`Audit manifest: ${resolve(auditPath)}`);
  }

  if (dryRun) {
    audit.upload = { status: "skipped-dry-run", uploadedBooks: 0, uploadedChapters: 0, batches: [] };
    await persistAudit();
    console.log("Dry run complete; nothing was uploaded.");
  } else {
    {
      console.log(`Uploading ${allBooks.length} book(s): existing slugs will be updated atomically by the importer.`);
      const token = getImportToken();
      if (!token) throw new Error("No import token found.");
      const apiUrl = option("--api-url", "https://somanovel.uk/api/internal/book-import");
      let uploadedBooks = 0;
      let uploadedChapters = 0;
      audit.upload = { status: "running", uploadedBooks, uploadedChapters, batches: [] };
      await persistAudit();
      try {
        for (let start = 0; start < allBooks.length; start += batchSize) {
          const batchNumber = start / batchSize + 1;
          const batch = allBooks.slice(start, start + batchSize);
          const { response, result, attempts } = await fetchJsonWithRetry(apiUrl, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ books: batch }) }, { label: `Upload batch ${batchNumber}` });
          if (!response.ok) throw new Error(`Batch ${batchNumber} failed (${response.status}): ${result.error ?? "Unknown error"}`);
          uploadedBooks += result.importedBooks;
          uploadedChapters += result.importedChapters;
          audit.upload.uploadedBooks = uploadedBooks;
          audit.upload.uploadedChapters = uploadedChapters;
          audit.upload.batches.push({ batch: batchNumber, status: "complete", attempts, slugs: batch.map((book) => book.slug), books: result.importedBooks, chapters: result.importedChapters });
          await persistAudit();
          console.log(`Uploaded batch ${batchNumber}: ${result.importedBooks} book(s), ${result.importedChapters} chapter(s)${attempts > 1 ? ` after ${attempts} attempts` : ""}.`);
        }
      } catch (error) {
        audit.upload.status = "failed";
        audit.upload.error = error instanceof Error ? error.message : String(error);
        await persistAudit();
        throw error;
      }
      audit.upload.status = "complete";
      await persistAudit();
      console.log(`Completed: ${uploadedBooks} book(s), ${uploadedChapters} chapter(s).`);
    }
  }
} finally {
  await rm(temp, { recursive: true, force: true });
}
