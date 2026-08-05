#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { inferLanguage, inferTitle, manuscriptScore, parseChapters } from "./soma-manuscript-compat.mjs";

function usage() {
  console.error("Usage: node scripts/build-soma-import.mjs <book-folder> [--manuscript file] [--cover file] [--language en|sw] [--out file.json] [--author name] [--category category] [--description text] [--translation-of original-slug] [--publish] [--upload]");
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

async function walk(folder) {
  const entries = await readdir(folder, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory() ? walk(join(folder, entry.name)) : [join(folder, entry.name)]));
  return nested.flat();
}

async function optionalJson(path) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return {}; }
}

async function optionalText(path) {
  try { return await readFile(path, "utf8"); } catch { return ""; }
}

function coverScore(path, language) {
  const lower = path.toLowerCase();
  if (!/\.(?:jpe?g|png|webp)$/.test(lower) || /(promo|video|frame|caption|contact.sheet)/.test(lower)) return -Infinity;
  const name = basename(lower);
  let score = 0;
  if (/cover/.test(name)) score += 30;
  if (language === "en" && (/(?:^|[_\-.])en(?:[_\-.]|$)/.test(name) || /english/.test(name))) score += 50;
  if (language === "sw" && (/(?:^|[_\-.])sw(?:[_\-.]|$)/.test(name) || /swahili|kiswahili/.test(name))) score += 50;
  if (language === "en" && /(?:^|[_\-.])sw(?:[_\-.]|$)/.test(name)) score -= 100;
  if (language === "sw" && /(?:^|[_\-.])en(?:[_\-.]|$)/.test(name)) score -= 100;
  if (/\.jpe?g$/.test(name)) score += 5;
  return score;
}

function extractDetailSynopsis(markdown) {
  const detailHeading = /^##\s+(?:Version B|Toleo B)\b.*$/im.exec(markdown);
  if (!detailHeading || detailHeading.index === undefined) return "";
  const afterHeading = markdown.slice(detailHeading.index + detailHeading[0].length);
  const nextHeading = /^##\s+/m.exec(afterHeading);
  return afterHeading.slice(0, nextHeading?.index).split("\n").map((line) => line.trim().replace(/^>\s?/, "")).filter((line) => line && line !== "---").join("\n\n").trim();
}

const folderArg = process.argv[2];
if (!folderArg || folderArg.startsWith("--")) usage();

const folder = resolve(folderArg);
const metadata = await optionalJson(join(folder, "story_meta.json"));
const files = await walk(folder);
const explicitManuscript = option("--manuscript", "");
let manuscriptPath = explicitManuscript ? resolve(folder, explicitManuscript) : null;
let markdown = manuscriptPath ? await readFile(manuscriptPath, "utf8") : "";
let language = option("--language", String(metadata.language ?? "").toLowerCase().includes("english") ? "en" : String(metadata.language ?? "").toLowerCase().match(/swahili|kiswahili/) ? "sw" : "");
if (manuscriptPath && !language) language = inferLanguage(markdown, basename(manuscriptPath));
if (!manuscriptPath) {
  const candidates = [];
  for (const path of files.filter((path) => manuscriptScore(basename(path)) > -Infinity)) {
    const source = await optionalText(path);
    const inferred = inferLanguage(source, basename(path));
    if (!inferred || (language && inferred !== language) || !parseChapters(source).length) continue;
    candidates.push({ path, source, language: inferred, score: manuscriptScore(basename(path)) });
  }
  if (!language && new Set(candidates.map((candidate) => candidate.language)).size > 1) throw new Error("This folder contains both English and Kiswahili manuscripts. Pass --language or use upload-soma-books.mjs for automatic pairing.");
  candidates.sort((left, right) => right.score - left.score || left.path.localeCompare(right.path));
  const selected = candidates[0];
  if (!selected) throw new Error("No completed manuscript with recognizable Chapter/Sura headings was found.");
  manuscriptPath = selected.path; markdown = selected.source; language ||= selected.language;
}
if (language !== "en" && language !== "sw") throw new Error("Language must be en or sw.");
const explicitCover = option("--cover", "");
const coverPath = explicitCover ? resolve(folder, explicitCover) : files.map((path) => ({ path, score: coverScore(path, language) })).filter((item) => item.score > -Infinity).sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))[0]?.path;
const coverBytes = coverPath ? await readFile(coverPath) : null;
const title = String(metadata.title ?? inferTitle(markdown, basename(manuscriptPath)) ?? basename(folder).replace(/_斯瓦希里语版$/, "")).trim();
const synopsisPath = join(folder, "book_synopsis.md");
const synopsis = await optionalText(synopsisPath).then(extractDetailSynopsis);
const description = option("--description", synopsis || String(metadata.description ?? "").trim()).trim();
const status = process.argv.includes("--publish") ? "published" : "draft";
const chapters = parseChapters(markdown, status);
if (!chapters.length) throw new Error("No chapters found. Supported examples: '# Chapter One: Title', '## Chapter 1: Title', or 'Sura ya Kwanza: Title'.");
const chapterNumbers = chapters.map((chapter) => chapter.number);
if (new Set(chapterNumbers).size !== chapterNumbers.length || chapterNumbers.some((number, index) => number !== index + 1)) throw new Error(`Chapter numbers must be unique and continuous from 1. Found: ${chapterNumbers.join(", ")}.`);
if (process.argv.includes("--publish") && !description) {
  throw new Error(`“${title}” cannot be published: add a Version B/Toleo B detail synopsis to ${synopsisPath}, add description to ${join(folder, "story_meta.json")}, or pass --description.`);
}
if (process.argv.includes("--publish") && !coverBytes) throw new Error(`“${title}” cannot be published: no matching ${language.toUpperCase()} cover image was found.`);

const extension = coverPath ? extname(coverPath).toLowerCase() : "";
const mime = extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : "image/jpeg";
const coverDataUrl = coverBytes ? `data:${mime};base64,${coverBytes.toString("base64")}` : undefined;
const payload = {
  books: [{
    slug: slugify(title) + (language === "sw" ? "-sw" : ""),
    title,
    author: option("--author", String(metadata.author ?? "").trim() || "Soma Originals"),
    language,
    category: option("--category", "thriller"),
    description,
    status,
    translationOfSlug: option("--translation-of", String(metadata.translation_of_slug ?? metadata.translationOfSlug ?? "")) || undefined,
    coverDataUrl,
    chapters,
  }],
};

const output = resolve(option("--out", join(folder, "soma-import.json")));
await writeFile(output, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Created ${output} (${language.toUpperCase()}, ${chapters.length} chapters, ${coverBytes ? "cover included" : "draft without cover"}).`);

if (process.argv.includes("--upload")) {
  const apiUrl = option("--api-url", "https://read.20140128.xyz/api/internal/book-import");
  const token = process.env.SOMA_IMPORT_TOKEN || execFileSync("security", ["find-generic-password", "-s", "Soma Book Import Token", "-w"], { encoding: "utf8" }).trim();
  if (!token) throw new Error("No import token found. Set SOMA_IMPORT_TOKEN or save it in Keychain as 'Soma Book Import Token'.");
  const response = await fetch(apiUrl, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Upload failed (${response.status}): ${result.error ?? "Unknown error"}`);
  console.log(`Uploaded ${result.importedBooks} book(s) and ${result.importedChapters} chapter(s).`);
}
