import { readdir, lstat, readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

export const SEO_TREES = Object.freeze(["books", "read", "reader-data"]);
export const SEO_FILES = Object.freeze([
  "catalog/books.json", "catalog/home-seo.json",
  "sitemap.xml", "feed.xml", "robots.txt",
  "llms.txt", "llms-full.txt", "llm-policy.json", "ai.txt",
]);
export const SEO_SITEMAP = /^sitemap-[a-z0-9-]+\.xml$/;
export const SEO_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function ownedBySeo(relativePath) {
  if (typeof relativePath !== "string" || !relativePath ||
      relativePath.startsWith("/") || relativePath.includes("\\") ||
      relativePath.split("/").some((part) => part === "" || part === "." || part === "..")) return false;
  return SEO_TREES.some((dir) => relativePath.startsWith(dir + "/")) ||
    SEO_FILES.includes(relativePath) || SEO_SITEMAP.test(relativePath);
}

export function inside(root, rel) {
  if (!ownedBySeo(rel)) throw new Error("Unowned SEO asset: " + rel);
  const base = resolve(root);
  const target = resolve(base, rel);
  if (!target.startsWith(base + sep)) throw new Error("Path escapes asset root: " + rel);
  return target;
}

async function safeEntry(path) {
  const entry = await lstat(path);
  if (entry.isSymbolicLink() || (!entry.isDirectory() && !entry.isFile())) {
    throw new Error("Unsafe asset node: " + path);
  }
  return entry;
}

export async function enumerateSeoFiles(root) {
  const base = resolve(root);
  const baseNode = await safeEntry(base);
  if (!baseNode.isDirectory()) throw new Error("SEO root must be a directory");
  const results = [];
  async function walk(dir) {
    const names = (await readdir(dir)).sort();
    for (const name of names) {
      const path = join(dir, name);
      const entry = await safeEntry(path);
      if (entry.isDirectory()) await walk(path);
      else {
        const rel = relative(base, path).split(sep).join("/");
        if (!ownedBySeo(rel)) throw new Error("Unowned file in SEO tree: " + rel);
        results.push(rel);
      }
    }
  }
  for (const tree of SEO_TREES) {
    const dir = join(base, tree);
    const st = await lstat(dir).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (st) {
      if (!st.isDirectory() || st.isSymbolicLink()) throw new Error("Unsafe SEO directory: " + dir);
      await walk(dir);
    }
  }
  const catalog = join(base, "catalog");
  const cst = await lstat(catalog).catch((error) => error.code === "ENOENT" ? null : Promise.reject(error));
  if (cst) {
    if (!cst.isDirectory() || cst.isSymbolicLink()) throw new Error("Unsafe catalog: " + catalog);
    for (const name of (await readdir(catalog)).sort()) {
      const p = join(catalog, name);
      const st = await safeEntry(p);
      if (!st.isFile()) throw new Error("Unexpected catalog directory: " + p);
      const rel = "catalog/" + name;
      if (!ownedBySeo(rel)) throw new Error("Unclassified catalog output: " + rel);
      results.push(rel);
    }
  }
  for (const name of await readdir(base)) {
    if (!SEO_FILES.includes(name) && !SEO_SITEMAP.test(name)) continue;
    const p = join(base, name);
    const st = await safeEntry(p);
    if (!st.isFile()) throw new Error("Generated SEO root path not a file: " + name);
    results.push(name);
  }
  return results.sort();
}

export async function assertSeoSnapshot(root, { requireHomepage = true } = {}) {
  const names = await enumerateSeoFiles(root);
  const set = new Set(names);
  const required = SEO_FILES.filter((name) => requireHomepage || name !== "catalog/home-seo.json");
  for (const path of required) if (!set.has(path)) throw new Error("Missing SEO output: " + path);
  if (!set.has("books/index.html")) throw new Error("Missing SEO books directory index");
  const catalog = JSON.parse(await readFile(inside(root, "catalog/books.json"), "utf8"));
  if (!Array.isArray(catalog)) throw new Error("SEO catalog is not an array");
  const slugs = new Set();
  for (const book of catalog) {
    if (!SEO_SLUG.test(book.slug) || slugs.has(book.slug)) throw new Error("Invalid or duplicate book slug");
    slugs.add(book.slug);
    for (const path of ["books/" + book.slug + "/index.html", "reader-data/" + book.slug + "/manifest.json"]) {
      if (!set.has(path)) throw new Error("Missing published book asset: " + path);
    }
    const manifest = JSON.parse(await readFile(inside(root, "reader-data/" + book.slug + "/manifest.json"), "utf8"));
    if (!Array.isArray(manifest.chapters) || !manifest.chapters.length ||
        Number(book.total_chapters) !== manifest.chapters.length) throw new Error("Incomplete reader manifest: " + book.slug);
    for (const ch of manifest.chapters) {
      const path = "read/" + book.slug + "/" + ch.number + ".html";
      if (!set.has(path)) throw new Error("Missing chapter HTML: " + path);
    }
  }
  for (const name of names.filter((x) => x.startsWith("books/") && x !== "books/index.html")) {
    const slug = name.split("/")[1];
    if (!slugs.has(slug)) throw new Error("Orphan published book page: " + name);
  }
  return { files: names.length, books: slugs.size, names };
}
