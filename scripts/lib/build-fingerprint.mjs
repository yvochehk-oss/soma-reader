import { createHash } from "node:crypto";
import { readdir, lstat, readFile, stat } from "node:fs/promises";
import { resolve, relative, join, sep } from "node:path";
import { ownedBySeo } from "./seo-asset-contract.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const INPUT_DIRS = ["app", "src", "workers", "scripts", "public"];
const INPUT_FILES = [
  "index.html", "server.ts", "package.json", "package-lock.json", "wrangler.jsonc",
  "wrangler.preview.jsonc", "open-next.config.ts", "next.config.ts", "vite.config.ts",
  "tsconfig.json", "tsconfig.vite.json", "eslint.config.mjs", "postcss.config.mjs",
  "postcss.config.js", "tailwind.config.js", "tailwind.config.ts",
];

async function walk(base, dir, output, ignored) {
  const names = (await readdir(dir)).sort();
  for (const name of names) {
    const path = join(dir, name), st = await lstat(path);
    const rel = relative(base, path).split(sep).join("/");
    if (ignored(rel)) continue;
    if (st.isSymbolicLink()) throw new Error("Fingerprint refuses symlink: " + rel);
    if (st.isDirectory()) await walk(base, path, output, ignored);
    else if (st.isFile()) output.push({ rel, path });
    else throw new Error("Fingerprint refuses non-regular node: " + rel);
  }
}

export async function fingerprintFiles(base, options = {}) {
  base = resolve(base);
  const dirs = options.dirs ?? INPUT_DIRS;
  const files = options.files ?? INPUT_FILES;
  const ignored = options.ignored ?? ((rel) =>
    (rel.startsWith("public/") && ownedBySeo(rel.slice(7))) ||
    rel.startsWith("scripts/tests/") || rel.includes("/__pycache__/") ||
    rel.endsWith(".pyc"));
  const found = [];
  for (const dir of dirs) {
    const location = resolve(base, dir);
    const st = await lstat(location).catch((e) => e.code === "ENOENT" ? null : Promise.reject(e));
    if (!st) continue;
    if (!st.isDirectory() || st.isSymbolicLink()) throw new Error("Invalid input directory: " + dir);
    await walk(base, location, found, ignored);
  }
  for (const rel of files) {
    const location = resolve(base, rel);
    const st = await lstat(location).catch((e) => e.code === "ENOENT" ? null : Promise.reject(e));
    if (!st) continue;
    if (!st.isFile() || st.isSymbolicLink()) throw new Error("Invalid input file: " + rel);
    found.push({ rel, path: location });
  }
  found.sort((a, b) => a.rel.localeCompare(b.rel, "en"));
  const seen = new Set(), entries = [];
  for (const f of found) {
    if (seen.has(f.rel)) throw new Error("Duplicate fingerprint path: " + f.rel);
    seen.add(f.rel);
    const bytes = await readFile(f.path);
    entries.push(f.rel + "\0" + bytes.length + "\0" + hash(bytes));
  }
  return { sha256: hash(entries.join("\n")), fileCount: entries.length };
}

function parseBuildEnv(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const matched = line.match(/^\s*(?:export\s+)?(VITE_[A-Za-z0-9_]+|NEXT_PUBLIC_[A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (matched) values[matched[1]] = matched[2].replace(/^["']|["']$/g, "");
  }
  return values;
}

export async function fingerprintEnv(base, providedEnv = process.env) {
  const values = {};
  for (const name of [".env", ".env.local", ".env.production"]) {
    const contents = await readFile(resolve(base, name), "utf8").catch((error) =>
      error.code === "ENOENT" ? null : Promise.reject(error));
    if (contents !== null) Object.assign(values, parseBuildEnv(contents));
  }
  for (const [key, value] of Object.entries(providedEnv)) {
    if (/^(VITE_|NEXT_PUBLIC_)/.test(key)) values[key] = String(value);
  }
  const sorted = Object.keys(values).sort().map((name) => [name, hash(values[name])]);
  return hash(JSON.stringify({ schema: 1, node: process.version, buildEnv: sorted }));
}

export async function digestTree(root, { allowMissing = false } = {}) {
  root = resolve(root);
  const st = await lstat(root).catch((e) => e.code === "ENOENT" ? null : Promise.reject(e));
  if (!st) {
    if (allowMissing) return null;
    throw new Error("Missing asset tree: " + root);
  }
  if (!st.isDirectory() || st.isSymbolicLink()) throw new Error("Unsafe asset tree: " + root);
  const found = [];
  await walk(root, root, found, () => false);
  const entries = [];
  for (const file of found.sort((a,b) => a.rel.localeCompare(b.rel,"en"))) {
    const bytes = await readFile(file.path);
    entries.push(file.rel + "\0" + bytes.length + "\0" + hash(bytes));
  }
  return hash(entries.join("\n"));
}

export async function buildFingerprint(root, providedEnv = process.env) {
  const [code, env] = await Promise.all([fingerprintFiles(root), fingerprintEnv(root, providedEnv)]);
  return { schemaVersion: 1, algorithm: "soma-inputs-1", codeFingerprint: code.sha256,
    buildEnvFingerprint: env, codeFiles: code.fileCount };
}
export async function shaFile(path) { return hash(await readFile(path)); }
