#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchJsonWithRetry, getImportToken } from "./lib/soma-release-http.mjs";
import { validateCliOptions } from "./lib/soma-cli.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const PROJECT_ROOT = resolve(dirname(SCRIPT_PATH), "..");
const VALUE_FLAGS = ["--author", "--category", "--tags", "--description", "--batch-size", "--api-url"];

process.env.WRANGLER_CONFIG_DIR = process.env.WRANGLER_CONFIG_DIR || resolve(process.env.HOME || "", ".wrangler_hk");

function usage() {
  console.error("Usage: node scripts/release-soma-books.mjs <books-folder> --publish --deploy [--dry-run] [--audit-out file.json] [--site-url https://somanovel.uk] [upload options]");
  process.exit(1);
}

function option(args, name, fallback = "") {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function forwardedUploadArgs(args) {
  const forwarded = [];
  for (const flag of VALUE_FLAGS) {
    const value = option(args, flag);
    if (value) forwarded.push(flag, value);
  }
  forwarded.push("--publish");
  return forwarded;
}

function auditFilename() {
  return `soma-books-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
}

async function runCommand(command, args) {
  await new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: PROJECT_ROOT, env: process.env, stdio: "inherit" });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} ${args.join(" ")} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}.`));
    });
  });
}

function sameTags(left, right) {
  return JSON.stringify([...left].map((tag) => tag.toLowerCase()).sort()) === JSON.stringify([...right].map((tag) => tag.toLowerCase()).sort());
}

export function verifyDatabaseBooks(expectedBooks, actualBooks) {
  const errors = [];
  const actualBySlug = new Map(actualBooks.map((book) => [book.slug, book]));
  for (const expected of expectedBooks) {
    const actual = actualBySlug.get(expected.slug);
    if (!actual) { errors.push(`${expected.slug}: missing from published Supabase catalogue`); continue; }
    if (actual.title !== expected.title) errors.push(`${expected.slug}: title mismatch`);
    if ((actual.author ?? actual.author_name) !== expected.author) errors.push(`${expected.slug}: author mismatch`);
    if ((actual.language ?? actual.language_code) !== expected.language) errors.push(`${expected.slug}: language mismatch`);
    if (actual.category !== expected.category) errors.push(`${expected.slug}: category mismatch`);
    if (actual.status !== expected.status) errors.push(`${expected.slug}: status is ${actual.status}, expected ${expected.status}`);
    const totalChapters = actual.totalChapters ?? actual.total_chapters;
    if (totalChapters !== expected.chapters) errors.push(`${expected.slug}: total_chapters is ${totalChapters}, expected ${expected.chapters}`);
    if (actual.actualChapters !== expected.chapters) errors.push(`${expected.slug}: actual chapter rows are ${actual.actualChapters}, expected ${expected.chapters}`);
    if (actual.publishedChapters !== expected.chapters) errors.push(`${expected.slug}: published chapter rows are ${actual.publishedChapters}, expected ${expected.chapters}`);
    const descriptionLength = actual.descriptionLength ?? actual.description?.length ?? 0;
    if (descriptionLength !== expected.descriptionLength) errors.push(`${expected.slug}: description mismatch`);
    if (!sameTags(actual.tags ?? [], expected.tags ?? [])) errors.push(`${expected.slug}: tags mismatch`);
    const coverUrl = actual.coverUrl ?? actual.cover_url;
    if (!coverUrl) errors.push(`${expected.slug}: cover_url is missing`);
    if (expected.coverUploaded && !/[?&]v=\d+/.test(coverUrl ?? "")) errors.push(`${expected.slug}: uploaded cover URL is not versioned`);
    if ((actual.parentSlug ?? null) !== (expected.translationOfSlug ?? null)) errors.push(`${expected.slug}: translation pairing mismatch`);
  }
  return errors;
}

export async function inspectPublishedBooks(expectedBooks, apiUrl, token) {
  const auditUrl = new URL(apiUrl);
  auditUrl.search = "";
  for (const book of expectedBooks) auditUrl.searchParams.append("slug", book.slug);
  const { response, result } = await fetchJsonWithRetry(auditUrl, {
    headers: { authorization: `Bearer ${token}` },
  }, { label: "Protected Supabase release verification" });
  if (!response.ok) throw new Error(`Protected Supabase release verification failed (${response.status}): ${result.error ?? "Unknown error"}`);
  if (!Array.isArray(result.books)) throw new Error("Protected Supabase release verification returned an invalid response.");
  if (Array.isArray(result.missingSlugs) && result.missingSlugs.length) {
    throw new Error(`Missing published book slug(s): ${result.missingSlugs.join(", ")}.`);
  }
  return result.books;
}

async function verifyLocalSeo(expectedBooks, actualBooks, siteUrl) {
  const sitemapEn = await readFile(resolve(PROJECT_ROOT, "public/sitemap-books-en.xml"), "utf8").catch(() => "");
  const sitemapSw = await readFile(resolve(PROJECT_ROOT, "public/sitemap-books-sw.xml"), "utf8").catch(() => "");
  const sitemapIndex = await readFile(resolve(PROJECT_ROOT, "public/sitemap.xml"), "utf8").catch(() => "");
  const sitemapCombined = `${sitemapIndex}\n${sitemapEn}\n${sitemapSw}`;

  const catalogue = JSON.parse(await readFile(resolve(PROJECT_ROOT, "public/catalog/books.json"), "utf8"));
  const catalogueSlugs = new Set(catalogue.map((book) => book.slug));
  const actualBySlug = new Map(actualBooks.map((book) => [book.slug, book]));
  for (const book of expectedBooks) {
    const html = await readFile(resolve(PROJECT_ROOT, "public/books", book.slug, "index.html"), "utf8");
    const canonical = `${siteUrl}/books/${book.slug}/`;
    const coverUrl = actualBySlug.get(book.slug)?.coverUrl ?? actualBySlug.get(book.slug)?.cover_url;
    if (!html.includes(`rel="canonical" href="${canonical}"`)) throw new Error(`${book.slug}: generated SEO page has the wrong canonical URL.`);
    if (!html.includes('property="og:image"')) throw new Error(`${book.slug}: generated SEO page has no og:image.`);
    if (!html.includes('"@type":"Book"') || !html.includes('"image"')) throw new Error(`${book.slug}: generated SEO page has no Schema.org Book image.`);
    if (coverUrl && !html.includes(coverUrl)) throw new Error(`${book.slug}: generated SEO page does not contain the current cover URL.`);
    if (!sitemapCombined.includes(canonical)) throw new Error(`${book.slug}: sitemap is missing the canonical URL.`);
    if (!catalogueSlugs.has(book.slug)) throw new Error(`${book.slug}: public catalogue is missing the book.`);
  }
  return { pages: expectedBooks.length, sitemap: true, catalogue: true };
}

async function fetchUntil(url, predicate, label, attempts = 5) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "follow" });
      const body = predicate.length >= 2 ? await response.text() : "";
      if (response.ok && predicate(response, body)) return { status: response.status, contentType: response.headers.get("content-type") ?? "" };
      lastError = new Error(`${label} returned ${response.status} or stale content.`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts - 1) await new Promise((resolvePromise) => setTimeout(resolvePromise, Math.min(750 * (2 ** attempt), 6_000)));
  }
  throw lastError instanceof Error ? lastError : new Error(`${label} failed.`);
}

async function verifyLive(expectedBooks, actualBooks, siteUrl) {
  const actualBySlug = new Map(actualBooks.map((book) => [book.slug, book]));
  for (const book of expectedBooks) {
    const encoded = encodeURIComponent(book.slug);
    await fetchUntil(`${siteUrl}/book/${encoded}`, (_response, body) => body.includes(book.title), `${book.slug} reader page`);
    const coverUrl = actualBySlug.get(book.slug)?.coverUrl ?? actualBySlug.get(book.slug)?.cover_url;
    if (!coverUrl) throw new Error(`${book.slug}: no cover URL available for live verification.`);
    await fetchUntil(`${siteUrl}/books/${encoded}/`, (_response, body) => body.includes('property="og:image"') && body.includes(book.title) && body.includes(coverUrl), `${book.slug} SEO page`);
    await fetchUntil(coverUrl, (response) => (response.headers.get("content-type") ?? "").startsWith("image/"), `${book.slug} cover`);
  }
  await fetchUntil(`${siteUrl}/sitemap.xml`, (_response, body) => body.includes("sitemap-books-en.xml") || body.includes("sitemap-books-sw.xml") || expectedBooks.every((book) => body.includes(`${siteUrl}/books/${book.slug}/`)), "live sitemap");
  return { books: expectedBooks.length, readerPages: true, seoPages: true, covers: true, sitemap: true };
}

async function main() {
  const args = process.argv.slice(2);
  const rootArg = args[0];
  if (!rootArg || rootArg.startsWith("--")) usage();
  validateCliOptions(args.slice(1), {
    valueFlags: [...VALUE_FLAGS, "--audit-out", "--site-url"],
    booleanFlags: ["--publish", "--deploy", "--dry-run"],
  });
  if (!args.includes("--publish")) throw new Error("A release must include --publish so the full metadata gate is enforced.");
  const dryRun = args.includes("--dry-run");
  if (!dryRun && !args.includes("--deploy")) throw new Error("A production release requires --deploy. Use --dry-run for validation only.");

  const sourceRoot = resolve(rootArg);
  const siteUrl = option(args, "--site-url", "https://somanovel.uk").replace(/\/$/, "");
  const auditPath = resolve(option(args, "--audit-out", join("release-audits", auditFilename())));
  const temporary = await mkdtemp(join(tmpdir(), "soma-release-"));
  const audit = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceRoot,
    siteUrl,
    mode: dryRun ? "dry-run" : "production",
    status: "running",
    steps: [],
  };

  const persist = async () => {
    audit.updatedAt = new Date().toISOString();
    await mkdir(dirname(auditPath), { recursive: true });
    await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`);
  };
  const step = async (name, operation) => {
    const entry = { name, status: "running", startedAt: new Date().toISOString() };
    audit.steps.push(entry);
    await persist();
    try {
      entry.result = await operation();
      entry.status = "passed";
      entry.finishedAt = new Date().toISOString();
      await persist();
      return entry.result;
    } catch (error) {
      entry.status = "failed";
      entry.finishedAt = new Date().toISOString();
      entry.error = error instanceof Error ? error.message : String(error);
      await persist();
      throw error;
    }
  };

  try {
    const preflightPath = join(temporary, "preflight.json");
    await step("source-and-metadata-preflight", async () => {
      await runCommand(process.execPath, ["scripts/upload-soma-books.mjs", sourceRoot, ...forwardedUploadArgs(args), "--dry-run", "--audit-out", preflightPath]);
      return JSON.parse(await readFile(preflightPath, "utf8"));
    });
    const preflight = JSON.parse(await readFile(preflightPath, "utf8"));
    audit.books = preflight.books;
    audit.totals = preflight.totals;

    if (dryRun) {
      audit.status = "validated-only";
      await persist();
      console.log(`Release validation passed. Audit: ${auditPath}`);
      return;
    }

    const importToken = getImportToken();
    if (!importToken) throw new Error("No import token found. Set SOMA_IMPORT_TOKEN (or BOOK_IMPORT_TOKEN) or save it in Keychain as 'Soma Book Import Token'.");
    const apiUrl = option(args, "--api-url", "https://somanovel.uk/api/internal/book-import");
    await step("database-upload", async () => {
      const uploadAuditPath = join(temporary, "upload.json");
      try {
        await runCommand(process.execPath, ["scripts/upload-soma-books.mjs", sourceRoot, ...forwardedUploadArgs(args), "--audit-out", uploadAuditPath]);
      } catch (error) {
        const partial = await readFile(uploadAuditPath, "utf8").then(JSON.parse).catch(() => null);
        const state = partial?.upload ? ` Uploaded before failure: ${partial.upload.uploadedBooks} book(s), ${partial.upload.uploadedChapters} chapter(s).` : "";
        throw new Error(`${error instanceof Error ? error.message : String(error)}${state}`);
      }
      const completed = JSON.parse(await readFile(uploadAuditPath, "utf8"));
      return completed.upload;
    });

    const actualBooks = await step("independent-supabase-verification", async () => {
      const actual = await inspectPublishedBooks(preflight.books, apiUrl, importToken);
      const errors = verifyDatabaseBooks(preflight.books, actual);
      if (errors.length) throw new Error(errors.join("; "));
      return actual;
    });

    await step("cloudflare-build-and-local-seo-verification", async () => {
      await runCommand("npm", ["run", "cf:build"]);
      return verifyLocalSeo(preflight.books, actualBooks, siteUrl);
    });
    await step("cloudflare-deploy-dry-run", async () => {
      await runCommand("npx", ["wrangler", "deploy", "--dry-run"]);
      return { passed: true };
    });
    await step("cloudflare-production-deploy", async () => {
      await runCommand("npx", ["wrangler", "deploy"]);
      return { deployed: true };
    });
    await step("live-site-verification", () => verifyLive(preflight.books, actualBooks, siteUrl));
    audit.status = "complete";
    await persist();
    console.log(`Release complete. Audit: ${auditPath}`);
  } catch (error) {
    const databaseStep = audit.steps.find((entry) => entry.name === "database-upload");
    const partialUpload = databaseStep?.status === "failed" && /Uploaded before failure: [1-9]\d* book/.test(databaseStep.error ?? "");
    audit.status = databaseStep?.status === "passed"
      ? "failed-after-database-upload"
      : partialUpload ? "failed-after-partial-database-upload" : "failed";
    audit.error = error instanceof Error ? error.message : String(error);
    await persist();
    console.error(`Release failed. Audit: ${auditPath}`);
    throw error;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(SCRIPT_PATH)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
