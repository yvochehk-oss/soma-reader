#!/usr/bin/env node
/**
 * release-and-record.mjs
 * Drop-in wrapper around scripts/release-soma-books.mjs that:
 *   1) runs the release (--publish --deploy, optionally --dry-run)
 *   2) reads the audit JSON it writes
 *   3) re-runs sync on the same folder so the DB reflects the new cover sha256
 *   4) calls sw_books_pipeline.py record-release for each book the audit
 *      reports (action='create' or 'update' with status='published')
 *   5) calls sw_books_pipeline.py remote-check to confirm somanovel.uk agrees
 *
 * Usage:
 *   node scripts/release-and-record.mjs <books-folder> [--dry-run] [--publish] [--deploy]
 */
import { spawn } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_DIR, "..");
const AUDITS_DIR = resolve(PROJECT_ROOT, "release-audits");

function arg(name, fallback = "") {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const BOOKS_FOLDER = process.argv[2];
if (!BOOKS_FOLDER) {
  console.error("Usage: node scripts/release-and-record.mjs <books-folder> [--dry-run] [--publish] [--deploy]");
  process.exit(1);
}

const args = [
  "scripts/release-soma-books.mjs",
  BOOKS_FOLDER,
  ...process.argv.slice(3),
];

console.log("🚀 launch:", "node", args.join(" "));
const child = spawn(process.execPath, args, { cwd: PROJECT_ROOT, stdio: "inherit" });
child.on("exit", async (code) => {
  if (code !== 0) {
    console.error(`❌ release exit ${code}`);
    process.exit(code);
  }
  try {
    await recordFromLatestAudit();
  } catch (e) {
    console.error("❌ record step failed:", e.message);
    process.exit(2);
  }
});

async function recordFromLatestAudit() {
  const entries = await readdir(AUDITS_DIR);
  const audits = (await Promise.all(
    entries
      .filter((n) => n.startsWith("soma-books-") && n.endsWith(".json"))
      .map(async (n) => {
        const full = join(AUDITS_DIR, n);
        const stat = (await import("node:fs/promises")).stat;
        const s = await stat(full);
        return { path: full, mtime: s.mtimeMs, name: n };
      }),
  )).sort((a, b) => b.mtime - a.mtime);

  if (audits.length === 0) {
    console.error("❌ no audit file found in", AUDITS_DIR);
    process.exit(3);
  }
  const latest = audits[0].path;
  console.log(`📄 latest audit: ${latest}`);
  const audit = JSON.parse(await readFile(latest, "utf-8"));

  // 重新 sync 这一批书,确保 db 内 cover sha256 是最新
  const bookIds = extractBookIds(audit);
  for (const id of bookIds) {
    runUv(`scripts/sw_books_pipeline.py sync --folder ${id}`);
  }

  // 对 audit.books(发布结果)逐条 record
  for (const b of audit.books || []) {
    const bookId = matchBookId(bookIds, b.slug);
    if (!bookId) {
      console.warn(`  ⚠  can not match slug '${b.slug}' to a book_id, skip`);
      continue;
    }
    const result = (b.status === "published") ? (b.action === "create" ? "published" : "updated") : "skipped";
    runUv(
      `scripts/sw_books_pipeline.py record-release ${bookId} ` +
      `--mode ${audit.mode || "production"} ` +
      `--result ${result} ` +
      `--audit-json "${latest}" ` +
      `--remote-status ${b.status || "unknown"} ` +
      `--remote-chapters ${b.chapters || 0} ` +
      `--remote-slug ${b.slug} ` +
      `--finished-at ${audit.generatedAt || ""}`,
    );
  }

  // 回查 somanovel.uk,确认 db 与远端一致
  console.log("🔍 remote-check via somanovel.uk/book-import...");
  runUv("scripts/sw_books_pipeline.py remote-check");
}

function extractBookIds(audit) {
  // 从 source 文件名反推:多本书的 books 列表中每个有 source 字段
  const ids = [];
  for (const b of audit.books || []) {
    if (!b.source) continue;
    const m = b.source.match(/^(20\d{2}-\d{2}-\d{2})_([a-z_]+)_/);
    if (m) ids.push(`${m[1]}_${m[2]}`);
  }
  return ids;
}

function matchBookId(bookIds, slug) {
  for (const id of bookIds) {
    if (id.endsWith("_" + slug) || id.endsWith(slug)) return id;
    if (slug.replace(/-/g, "_").includes(id.split("_").slice(1).join("_"))) return id;
  }
  return bookIds[0] || null;
}

function runUv(cmdline) {
  console.log(`\n▶ ${cmdline}`);
  const out = spawn("uv", ["run", "python3", ...cmdline.split(" ")], {
    cwd: PROJECT_ROOT,
    stdio: "inherit",
  });
  return new Promise((resolveP, reject) => {
    out.on("exit", (c) => (c === 0 ? resolveP() : reject(new Error(`exit ${c}`))));
  });
}
