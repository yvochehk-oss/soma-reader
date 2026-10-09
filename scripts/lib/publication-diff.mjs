import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

function asBookMap(books) {
  if (!Array.isArray(books)) throw new Error("Invalid published catalogue");
  const out = new Map();
  for (const book of books) {
    if (!book || typeof book.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(book.slug) ||
      out.has(book.slug)) throw new Error("Invalid or duplicate published slug");
    out.set(book.slug, book);
  }
  return out;
}

export function diffPublishedBooks(currentBooks, previousBooks = [], currentHashes = {}, previousHashes = {}) {
  const current = asBookMap(currentBooks);
  const previous = asBookMap(previousBooks);
  const added = [...current.values()].filter((book) => !previous.has(book.slug));
  const removed = [...previous.values()].filter((book) => !current.has(book.slug));
  const updated = [...current.values()].filter((book) =>
    previous.has(book.slug) &&
    (JSON.stringify(previous.get(book.slug)) !== JSON.stringify(book) ||
      !currentHashes[book.slug] || !previousHashes[book.slug] ||
      currentHashes[book.slug] !== previousHashes[book.slug]));
  return { added, updated, removed, changed: [...added, ...updated] };
}

const sha = (b) => createHash("sha256").update(b).digest("hex");
export async function changedChapterNumbers(currentRoot, previousRoot, slug, manifest) {
  if (!Array.isArray(manifest?.chapters)) throw new Error("Invalid chapter manifest for " + slug);
  const changed = [];
  for (const chapter of manifest.chapters) {
    const num = Number(chapter.number);
    if (!Number.isSafeInteger(num) || num < 1) throw new Error("Invalid chapter number for " + slug);
    const relative = "read/" + slug + "/" + num + ".html";
    const bytes = await readFile(resolve(currentRoot, relative));
    const prior = previousRoot ? await readFile(resolve(previousRoot, relative)).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    }) : null;
    if (prior === null || sha(prior) !== sha(bytes)) changed.push(num);
  }
  return changed;
}

export async function removedChapterNumbers(currentRoot, previousRoot, slug) {
  if (!previousRoot) return [];
  const priorPath = resolve(previousRoot, "reader-data", slug, "manifest.json");
  const previous = await readFile(priorPath, "utf8").then(JSON.parse);
  const current = await readFile(resolve(currentRoot, "reader-data", slug, "manifest.json"),"utf8").then(JSON.parse);
  if (!Array.isArray(previous.chapters) || !Array.isArray(current.chapters)) {
    throw new Error("Invalid source chapter manifest for " + slug);
  }
  const currentNumbers=new Set(current.chapters.map(c=>Number(c.number)));
  return previous.chapters.map(c=>Number(c.number)).filter(n=>!currentNumbers.has(n));
}
