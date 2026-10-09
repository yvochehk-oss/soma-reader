#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchJsonWithRetry, getImportToken } from "./lib/soma-release-http.mjs";
import { validateCliOptions } from "./lib/soma-cli.mjs";
import { assertCloudflareStaticAssetLimits } from "./lib/cloudflare-static-asset-limits.mjs";

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

function htmlEscape(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function treeStats(directory) {
  let files = 0;
  let bytes = 0;
  async function visit(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const path = resolve(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) {
        files += 1;
        bytes += (await stat(path)).size;
      }
    }
  }
  await visit(directory);
  return { files, bytes };
}

async function verifyLocalSeo(expectedBooks, actualBooks, siteUrl) {
  const sitemapEn = await readFile(resolve(PROJECT_ROOT, "public/sitemap-books-en.xml"), "utf8").catch(() => "");
  const sitemapSw = await readFile(resolve(PROJECT_ROOT, "public/sitemap-books-sw.xml"), "utf8").catch(() => "");
  const sitemapIndex = await readFile(resolve(PROJECT_ROOT, "public/sitemap.xml"), "utf8").catch(() => "");
  const sitemapCombined = `${sitemapIndex}\n${sitemapEn}\n${sitemapSw}`;

  const catalogue = JSON.parse(await readFile(resolve(PROJECT_ROOT, "public/catalog/books.json"), "utf8"));
  const cloudflareAssetStats = await assertCloudflareStaticAssetLimits(resolve(PROJECT_ROOT, ".open-next/assets"));
  const wranglerConfig = await readFile(resolve(PROJECT_ROOT, "wrangler.jsonc"), "utf8").catch(() => "");
  const readerWorker = await readFile(resolve(PROJECT_ROOT, ".open-next/worker.js"), "utf8").catch(() => "");
  const readerScript = await readFile(resolve(PROJECT_ROOT, "public/reader-static.js"), "utf8").catch(() => "");
  const readerStyle = await readFile(resolve(PROJECT_ROOT, "public/reader-static.css"), "utf8").catch(() => "");
  if (!wranglerConfig.includes('"html_handling": "auto-trailing-slash"') ||
      !wranglerConfig.includes('"run_worker_first": false') ||
      !wranglerConfig.includes('"not_found_handling": "none"')) {
    throw new Error("Cloudflare ASSETS must use auto-trailing-slash, asset-first routing, and no SPA/404 fallback for static reader pages.");
  }
  if (!readerWorker.includes('url.pathname.startsWith("/read/")') ||
      !readerWorker.includes('readerAssetUrl.pathname = readerPath + ".html";') ||
      !readerWorker.includes('new Response("Not Found", { status: 404 })')) {
    throw new Error("OpenNext Worker is missing the exact static HTML route or explicit 404 path for reader URLs.");
  }
  if (!readerScript || !readerStyle) throw new Error("Static reader JavaScript or stylesheet is missing from public/.");
  for (const asset of ["reader-static.js", "reader-static.css"]) {
    await readFile(resolve(PROJECT_ROOT, ".open-next/assets", asset)).catch(() => {
      throw new Error(`Cloudflare ASSETS is missing /${asset}.`);
    });
  }
  const catalogueSlugs = new Set(catalogue.map((book) => book.slug));
  const actualBySlug = new Map(actualBooks.map((book) => [book.slug, book]));
  const readerTargets = [];
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

    const manifest = JSON.parse(await readFile(resolve(PROJECT_ROOT, "public/reader-data", book.slug, "manifest.json"), "utf8"));
    if (manifest.schemaVersion !== 1 || manifest.book?.slug !== book.slug || !Array.isArray(manifest.chapters)) {
      throw new Error(`${book.slug}: static reader manifest is missing or invalid.`);
    }
    if (manifest.chapters.length !== book.chapters) {
      throw new Error(`${book.slug}: static reader manifest has ${manifest.chapters.length} chapters, expected ${book.chapters}.`);
    }
    const actual = actualBySlug.get(book.slug);
    const publishedCount = actual?.publishedChapters ?? actual?.published_chapters;
    if (publishedCount != null && Number(publishedCount) !== manifest.chapters.length) {
      throw new Error(`${book.slug}: static reader manifest has ${manifest.chapters.length} chapters, but Supabase reports ${publishedCount} published chapters.`);
    }
    const edgeBookDirectory = resolve(PROJECT_ROOT, ".open-next/assets/reader-data", book.slug);
    const edgeManifest = JSON.parse(await readFile(resolve(edgeBookDirectory, "manifest.json"), "utf8"));
    if (edgeManifest.chapters?.length !== manifest.chapters.length) throw new Error(`${book.slug}: manifest was not copied to Cloudflare ASSETS.`);
    const first = manifest.chapters[0];
    const last = manifest.chapters.at(-1);
    if (!first || !last) throw new Error(`${book.slug}: static reader manifest has no published chapters.`);
    for (const entry of manifest.chapters) {
      const publicPage = resolve(PROJECT_ROOT, "public/read", book.slug, `${entry.number}.html`);
      const edgePage = resolve(PROJECT_ROOT, ".open-next/assets/read", book.slug, `${entry.number}.html`);
      const [publicPageStats, edgePageStats] = await Promise.all([
        stat(publicPage).catch(() => null),
        stat(edgePage).catch(() => null),
      ]);
      if (!publicPageStats || !edgePageStats) {
        throw new Error(`${book.slug} chapter ${entry.number}: static HTML is missing from the build or Cloudflare ASSETS.`);
      }
      if (publicPageStats.size !== edgePageStats.size) {
        throw new Error(`${book.slug} chapter ${entry.number}: static HTML differs in Cloudflare ASSETS.`);
      }
    }
    for (const entry of new Map([[first.number, first], [last.number, last]]).values()) {
      const pagePath = resolve(PROJECT_ROOT, "public/read", book.slug, `${entry.number}.html`);
      const page = await readFile(pagePath, "utf8");
      const edgePage = await readFile(resolve(PROJECT_ROOT, ".open-next/assets/read", book.slug, `${entry.number}.html`), "utf8");
      const readerCanonical = `${siteUrl}/read/${book.slug}/${entry.number}`;
      if (!page.includes(`rel="canonical" href="${readerCanonical}"`) || !page.includes('<article class="reader-body" data-reader-content>')) {
        throw new Error(`${book.slug} chapter ${entry.number}: static reader HTML is missing its canonical or server-rendered body.`);
      }
      if (page.includes("self.__next_f.push") || page.includes("__next_f")) throw new Error(`${book.slug} chapter ${entry.number}: reader page unexpectedly contains a Next hydration payload.`);
      if (edgePage !== page) {
        throw new Error(`${book.slug} chapter ${entry.number}: reader HTML was not copied unchanged into Cloudflare ASSETS.`);
      }
      readerTargets.push({
        slug: book.slug,
        number: Number(entry.number),
        title: String(entry.title ?? ""),
        url: `/read/${book.slug}/${entry.number}`,
        missingUrl: Number(entry.number) === Number(last.number)
          ? `/read/${book.slug}/${Number(last.number) + 1}`
          : undefined,
      });
    }
  }
  const publicReader = await treeStats(resolve(PROJECT_ROOT, "public/read"));
  const publicManifests = await treeStats(resolve(PROJECT_ROOT, "public/reader-data"));
  const edgeReader = await treeStats(resolve(PROJECT_ROOT, ".open-next/assets/read"));
  const edgeManifests = await treeStats(resolve(PROJECT_ROOT, ".open-next/assets/reader-data"));
  if (publicReader.files !== edgeReader.files || publicManifests.files !== edgeManifests.files || publicReader.bytes !== edgeReader.bytes || publicManifests.bytes !== edgeManifests.bytes) {
    throw new Error("Generated reader files and Cloudflare ASSETS copies differ in file count or byte size.");
  }
  return {
    pages: expectedBooks.length,
    sitemap: true,
    catalogue: true,
    cloudflareAssets: cloudflareAssetStats,
    staticReader: { books: new Set(expectedBooks.map((book) => book.slug)).size, chapters: publicReader.files, manifestFiles: publicManifests.files, bytes: publicReader.bytes + publicManifests.bytes },
    readerTargets,
  };
}

async function fetchUntil(url, predicate, label, attempts = 10) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const fetchUrl = attempt > 0 ? (url.includes("?") ? `${url}&_cb=${Date.now()}` : `${url}?_cb=${Date.now()}`) : url;
      const response = await fetch(fetchUrl, { redirect: "follow", headers: { "cache-control": "no-cache" } });
      const body = predicate.length >= 2 ? await response.text() : "";
      if (response.ok && predicate(response, body)) return { status: response.status, contentType: response.headers.get("content-type") ?? "" };
      lastError = new Error(`${label} returned ${response.status} or stale content.`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts - 1) await new Promise((resolvePromise) => setTimeout(resolvePromise, Math.min(1000 * (2 ** attempt), 8_000)));
  }
  throw lastError instanceof Error ? lastError : new Error(`${label} failed.`);
}

async function verifyLive(expectedBooks, actualBooks, siteUrl, readerTargets = []) {
  const actualBySlug = new Map(actualBooks.map((book) => [book.slug, book]));
  for (const book of expectedBooks) {
    const encoded = encodeURIComponent(book.slug);
    await fetchUntil(`${siteUrl}/books/${encoded}/`, (_response, body) => body.includes(book.title), `${book.slug} SEO book page`);
    const coverUrl = actualBySlug.get(book.slug)?.coverUrl ?? actualBySlug.get(book.slug)?.cover_url;
    if (!coverUrl) throw new Error(`${book.slug}: no cover URL available for live verification.`);
    await fetchUntil(`${siteUrl}/books/${encoded}/`, (_response, body) => body.includes('property="og:image"') && body.includes(book.title) && body.includes(coverUrl), `${book.slug} SEO page`);
    await fetchUntil(coverUrl, (response) => (response.headers.get("content-type") ?? "").startsWith("image/"), `${book.slug} cover`);
  }
  await fetchUntil(`${siteUrl}/sitemap.xml`, (_response, body) => body.includes("sitemap-books-en.xml") || body.includes("sitemap-books-sw.xml") || expectedBooks.every((book) => body.includes(`${siteUrl}/books/${book.slug}/`)), "live sitemap");
  for (const target of readerTargets) {
    await fetchUntil(`${siteUrl}${target.url}`, (response, body) =>
      (response.headers.get("content-type") ?? "").toLowerCase().includes("text/html") &&
      new URL(response.url).pathname === target.url &&
      body.includes('data-reader-content') &&
      body.includes(`rel="canonical" href="${siteUrl}${target.url}"`) &&
      !body.includes("__next_f"), `${target.slug} chapter ${target.number} static reader HTML`);
    if (target.missingUrl) {
      const response = await fetch(`${siteUrl}${target.missingUrl}`, { cache: "no-store", redirect: "manual" });
      const body = await response.text();
      if (response.status !== 404 || body.includes("__next_f")) {
        throw new Error(`${target.slug} missing chapter URL ${target.missingUrl} must return a non-SSR 404.`);
      }
    }
  }
  return { books: expectedBooks.length, staticReaderTargets: readerTargets.length, readerPages: true, seoPages: true, covers: true, sitemap: true };
}

async function main() {
  const args = process.argv.slice(2);
  const rootArg = args[0];
  if (!rootArg || rootArg.startsWith("--")) usage();
  validateCliOptions(args.slice(1), {
    valueFlags: [...VALUE_FLAGS, "--audit-out", "--site-url"],
    booleanFlags: ["--publish", "--deploy", "--dry-run", "--data-only"],
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
    if (args.includes("--data-only")) {
      const approval = await readFile(resolve(PROJECT_ROOT, ".soma-deploy-state/preview-gates.json"), "utf8").then(JSON.parse).catch(() => null);
      if (!approval || approval.status !== "passed" || new Set(approval.validatedRuns || []).size < 3) {
        throw new Error("DATA_DEPLOY_BLOCKED: Three verified preview scenarios are required before database upload.");
      }
    }
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

    if (args.includes("--data-only")) {
      await step("cloudflare-data-deployment-with-shared-gates", async () => {
        await runCommand(process.execPath, ["scripts/deploy-soma-site.mjs", "--target", "production", "--data-only", "--approve-production"]);
        return { delegatedTo: "scripts/deploy-soma-site.mjs", requestedMode: "data" };
      });
      audit.status = "complete";
      await persist();
      console.log(`Release complete via shared data gate. Audit: ${auditPath}`);
      return;
    }

    const localBuild = await step("cloudflare-build-and-local-seo-verification", async () => {
      await runCommand("npm", ["run", "cf:build"]);
      return verifyLocalSeo(preflight.books, actualBooks, siteUrl);
    });
    await step("cloudflare-deploy-dry-run", async () => {
      await runCommand("npx", ["wrangler", "deploy", "--dry-run", "--no-autoconfig"]);
      return { passed: true };
    });
    await step("cloudflare-production-deploy", async () => {
      await runCommand("npx", ["wrangler", "deploy", "--no-autoconfig"]);
      return { deployed: true };
    });
    await step("live-site-verification", () => verifyLive(preflight.books, actualBooks, siteUrl, localBuild.readerTargets));
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
