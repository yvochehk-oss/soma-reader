#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, copyFile, rm, rename, lstat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { assertCloudflareStaticAssetLimits } from "./lib/cloudflare-static-asset-limits.mjs";
import { enumerateSeoFiles, inside, assertSeoSnapshot } from "./lib/seo-asset-contract.mjs";

const digest = (buffer) => createHash("sha256").update(buffer).digest("hex");
const has = (args, key) => args.includes(key);
function value(args, name) {
  const pos = args.indexOf(name);
  if (pos < 0 || !args[pos + 1] || args[pos + 1].startsWith("--")) throw new Error("Missing " + name);
  return args[pos + 1];
}
async function hashFile(root, name) {
  return digest(await readFile(inside(root, name)));
}
async function assertRoot(dir) {
  const st = await lstat(dir);
  if (!st.isDirectory() || st.isSymbolicLink()) throw new Error("Unsafe root: " + dir);
}
export async function planSync(source, target, { allowEmpty = false } = {}) {
  source = resolve(source); target = resolve(target);
  if (source === target || source.startsWith(target + "/") || target.startsWith(source + "/")) {
    throw new Error("Source and target must not overlap");
  }
  await assertRoot(source); await assertRoot(target);
  const s = await enumerateSeoFiles(source), t = await enumerateSeoFiles(target);
  const a = new Set(s), b = new Set(t);
  if (!allowEmpty && s.length === 0) throw new Error("Refusing empty SEO source");
  const changes = [];
  for (const path of s) {
    const left = await hashFile(source, path);
    const right = b.has(path) ? await hashFile(target, path) : null;
    changes.push({ path, action: right === null ? "new" : left === right ? "unchanged" : "updated", sha256: left });
  }
  for (const path of t) if (!a.has(path)) changes.push({ path, action: "removed" });
  changes.sort((x, y) => x.path.localeCompare(y.path));
  const counts = { new: 0, updated: 0, removed: 0, unchanged: 0 };
  for (const change of changes) counts[change.action]++;
  const removedBooks = changes.filter((c) => c.action === "removed" && /^books\/[^/]+\/index\.html$/.test(c.path)).length;
  const existingBooks = t.filter((p) => /^books\/[^/]+\/index\.html$/.test(p)).length;
  const deletionLimit = Math.max(5, Math.ceil(existingBooks * 0.05));
  return { schemaVersion: 1, source, target, counts, removedBooks, existingBooks, deletionLimit, changes };
}

export async function syncSeoAssets(source, target, options = {}) {
  if (!options.unsafeSkipSnapshotCheck) await assertSeoSnapshot(source);
  const plan = await planSync(source, target);
  if (plan.removedBooks > plan.deletionLimit && !options.approveMassDeletion) {
    throw new Error("MASS_DELETE_APPROVAL_REQUIRED: " + plan.removedBooks + " books");
  }
  if (!options.dryRun) {
    for (const entry of plan.changes) {
      const dest = inside(target, entry.path);
      if (entry.action === "removed") {
        await rm(dest, { force: true });
      } else if (entry.action !== "unchanged") {
        await mkdir(dirname(dest), { recursive: true });
        const tmp = dest + ".soma-" + process.pid + ".tmp";
        try { await copyFile(inside(source, entry.path), tmp); await rename(tmp, dest); }
        finally { await rm(tmp, { force: true }); }
      }
    }
    const after = await planSync(source, target);
    if (after.counts.new || after.counts.updated || after.counts.removed) throw new Error("SEO sync verification failed");
    await assertCloudflareStaticAssetLimits(target);
  }
  return plan;
}

async function main() {
  const args = process.argv.slice(2);
  const source = value(args, "--source");
  const target = value(args, "--target");
  const plan = await syncSeoAssets(source, target, {
    dryRun: has(args, "--dry-run"),
    approveMassDeletion: has(args, "--approve-mass-deletion"),
  });
  if (has(args, "--report-json")) {
    const path = resolve(value(args, "--report-json"));
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(plan, null, 2) + "\n");
  }
  if (has(args, "--verify") && !has(args, "--dry-run")) {
    const result = await planSync(source, target);
    if (result.counts.new || result.counts.updated || result.counts.removed) throw new Error("Post-sync verification failed");
  }
  console.log(JSON.stringify({ ...plan.counts, removedBooks: plan.removedBooks, dryRun: has(args, "--dry-run") }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
