#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertClassicSectionIntegrity, parseClassicSections } from './lib/classic-section-parser.mjs';
import { profileForClassic } from './lib/classic-section-profiles.mjs';

const args = process.argv.slice(2);
const auditOutIndex = args.indexOf('--audit-out');
if (auditOutIndex >= 0 && !args[auditOutIndex + 1]) throw new Error('--audit-out requires a path.');
const consumed = new Set(auditOutIndex >= 0 ? [auditOutIndex, auditOutIndex + 1] : []);
const rootArg = args.find((value, index) => !consumed.has(index) && !value.startsWith('--'));
const ROOT = resolve(rootArg || '/Users/yvoche/AI开发/000.非洲最终正文/0.2英文经典手机版');
const API_URL = process.env.SOMA_IMPORT_API || 'https://somanovel.uk/api/internal/book-import';
import { getSupabasePublicConfig } from './lib/soma-public-config.mjs';

let SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
let SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  const { url, key } = await getSupabasePublicConfig();
  SUPABASE_URL = SUPABASE_URL || url;
  SUPABASE_ANON_KEY = SUPABASE_ANON_KEY || key;
}
const CATALOG_PATH = resolve(process.env.CLASSICS_CATALOG_PATH || fileURLToPath(new URL('../classics_catalog.json', import.meta.url)));
const PUBLISH = args.includes('--publish');
const MAX_UPLOAD_ATTEMPTS = 5;
const CATEGORY_LABELS = new Set(['Romance', 'Thriller', 'Sci-Fi', 'Historical', 'Fantasy', 'Contemporary', 'Urban Fantasy']);

const romance = new Set(['Anna Karenina', 'Anne of Green Gables', 'Emma', 'Jane Eyre', 'Little Women', 'Mansfield Park', 'Northanger Abbey', 'Persuasion', 'Pride and Prejudice', 'Sense and Sensibility', "Tess of the d'Urbervilles", 'The Enchanted April']);
const thriller = new Set(['A Study in Scarlet', 'Crime and Punishment', 'Dracula', 'Frankenstein', 'The Hound of the Baskervilles', 'The House of the Seven Gables', 'The King in Yellow', 'The Memoires of Sherlock Holmes', 'The Moonstone', 'The Mysterious Affair at Styles', 'The Phantom of the Opera', 'The Picture of Dorian Gray', 'The Return of Sherlock Holmes', 'The Strange Case of Dr Jekyll and Mr Hyde', 'The Turn of the Screw', 'The Woman in White', 'The Works of Edgar Allan Poe - Volume 1', 'The Works of Edgar Allan Poe - Volume 2']);
const sciFi = new Set(['Anthem', 'The Invisible Man', 'The Time Machine', 'The War of the Worlds']);
const fantasy = new Set(["Alice's Adventures in Wonderland", 'Grimms\' Fairy Tales', 'The Blue Fairy Book', 'The Jungle Book', 'The Red Fairy Book', 'The Secret Garden', 'The Wonderful Wizard of Oz', 'The Yellow Fairy Book', 'Through the Looking-Glass']);
const contemporary = new Set(['Beyond Good and Evil', 'Heart of Darkness', 'Metamorphosis', 'Siddhartha', 'The Awakening', 'The Great Gatsby', 'Thus Spake Zarathustra', 'Ulysses', 'Walden']);
const historical = new Set(['A Christmas Carol', 'A Tale of Two Cities', 'Beowulf', 'David Copperfield', 'Don Quixote', 'Great Expectations', 'Gulliver\'s Travels', 'Les Misérables', 'Leviathan', 'Middlemarch', 'Moby-Dick', 'Narrative of the Life of Frederick Douglass', 'Oliver Twist', 'The Adventures of Huckleberry Finn', 'The Adventures of Sherlock Holmes', 'The Adventures of Tom Sawyer', 'The Call of the Wild', 'The Count of Monte Cristo', 'The Iliad', 'The Life and Adventures of Robinson Crusoe', 'The Odyssey', 'The Prince', 'The Republic', 'The Scarlet Letter', 'Treasure Island', 'War and Peace']);

function slugify(value) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function classify(title) {
  const category = romance.has(title) ? 'Romance'
    : thriller.has(title) ? 'Thriller'
      : sciFi.has(title) ? 'Sci-Fi'
        : fantasy.has(title) ? 'Fantasy'
          : contemporary.has(title) ? 'Contemporary'
            : historical.has(title) ? 'Historical'
              : 'Historical';
  const tags = ['Classic', 'English Classics'];
  if (category === 'Romance') tags.push('Romantic Fiction');
  if (category === 'Thriller') tags.push('Gothic', 'Mystery');
  if (category === 'Sci-Fi') tags.push('Science Fiction');
  if (category === 'Fantasy') tags.push('Children\'s Fantasy');
  if (category === 'Historical') tags.push('Historical Fiction');
  if (category === 'Contemporary') tags.push('Literary Fiction');
  if (/Sherlock Holmes|Poe|Mysterious Affair/.test(title)) tags.push('Detective');
  if (/Fairy|Alice|Oz|Jungle Book|Secret Garden|Looking-Glass/.test(title)) tags.push('Fairy Tale');
  return { category, tags };
}

function description(title, author, category) {
  return `${title} by ${author}, a public-domain English classic presented in a clean, phone-friendly edition. Browse this ${category.toLowerCase()} classic free on Soma.`;
}

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return fallback; }
}

async function findFile(folder, suffix, preferred) {
  try {
    const names = await readdir(folder);
    if (preferred && names.includes(preferred)) return join(folder, preferred);
    const match = names.find((name) => name.endsWith(suffix));
    return match ? join(folder, match) : null;
  } catch { return null; }
}

async function existingBooks() {
  try {
    const fields = 'slug,title,author_name,language_code,category,description,cover_url,tags,status,is_featured';
    const response = await fetch(`${SUPABASE_URL}/rest/v1/books?select=${fields}&limit=1000`, { headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}` } });
    if (!response.ok) return { available: false, map: new Map() };
    const rows = await response.json();
    return { available: true, map: new Map(rows.map((row) => [row.slug, row])) };
  } catch { return { available: false, map: new Map() }; }
}

function getToken() {
  if (process.env.SOMA_IMPORT_TOKEN) return process.env.SOMA_IMPORT_TOKEN;
  if (process.env.BOOK_IMPORT_TOKEN) return process.env.BOOK_IMPORT_TOKEN;
  try { return execFileSync('security', ['find-generic-password', '-s', 'Soma Book Import Token', '-w'], { encoding: 'utf8' }).trim(); } catch { return ''; }
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function uploadBook(apiUrl, token, item) {
  for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt += 1) {
    // The section parser already validated every integrity value locally (and aborts on mismatch),
    // and each chapter carries its word count, so the Worker skips its CPU-heavy recomputation and
    // only checks metadata self-consistency.
    const payload = item.updateMode === 'chapters-only' ? { updateMode: 'chapters-only', books: [item.book], precomputed: true } : { books: [item.book], precomputed: true };
    const response = await fetch(apiUrl, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => ({}));
    if (response.ok) return result;
    const transient = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
    if (!transient || attempt === MAX_UPLOAD_ATTEMPTS) {
      throw new Error(`Import failed for ${item.book.title} (${response.status}): ${result.error ?? 'Unknown error'}`);
    }
    const retryAfter = Number(response.headers.get('retry-after'));
    const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** (attempt - 1) * 1000;
    console.warn(`Transient import failure for ${item.book.title} (${response.status}); retrying in ${delay / 1000}s (${attempt}/${MAX_UPLOAD_ATTEMPTS - 1}).`);
    await wait(delay);
  }
  throw new Error(`Import failed for ${item.book.title}: retry loop exhausted.`);
}

const catalog = await readJson(CATALOG_PATH, []);
if (!Array.isArray(catalog) || !catalog.length) throw new Error(`Could not read ${CATALOG_PATH}`);
const state = await existingBooks();
if (PUBLISH && !state.available) throw new Error('Cannot publish safely because the existing online catalogue could not be read. Retry when Supabase is available.');
const prepared = [];
const skipped = [];
for (const item of catalog) {
  const folder = join(ROOT, `mobile_${item.title}`);
  const markdownPath = await findFile(folder, '_full_story.md', item.mobile_markdown_file);
  if (!markdownPath) { skipped.push({ title: item.title, reason: 'missing Markdown正文' }); continue; }
  const markdown = await readFile(markdownPath, 'utf8');
  const parsed = assertClassicSectionIntegrity(parseClassicSections(markdown, { profile: profileForClassic(item.title, markdown) }));
  if (parsed.audit.anomalies.long.length || parsed.audit.anomalies.contentsOnly.length || parsed.integrity.suspiciousShortChapterCount) {
    throw new Error(`${item.title}: parser integrity gate found unsafe chapter boundaries.`);
  }
  const chapters = parsed.chapters;
  const { category, tags } = classify(item.title);
  if (!CATEGORY_LABELS.has(category)) throw new Error(`${item.title}: invalid category ${category}`);
  const slug = slugify(item.title);
  const existing = state.map.get(slug);
  const updateMode = existing ? 'chapters-only' : 'full';
  let coverPath = null;
  let coverDataUrl;
  if (!existing) {
    coverPath = await findFile(folder, '_cover.jpg', item.cover_image);
    if (!coverPath) throw new Error(`${item.title}: missing cover image for new book`);
    const cover = await readFile(coverPath);
    coverDataUrl = `data:image/jpeg;base64,${cover.toString('base64')}`;
  }
  const book = {
    slug,
    title: existing?.title || item.title,
    author: existing?.author_name || item.author,
    language: existing?.language_code === 'sw' ? 'sw' : 'en',
    category: existing?.category || category,
    description: existing?.description || description(item.title, item.author, category),
    status: existing?.status || 'published',
    featured: existing?.is_featured === true,
    tags: Array.isArray(existing?.tags) ? existing.tags : tags,
    integrity: parsed.integrity,
    chapters,
  };
  if (existing?.cover_url) book.coverUrl = existing.cover_url;
  if (coverDataUrl) book.coverDataUrl = coverDataUrl;
  prepared.push({
    sourceFolder: folder,
    sourceMarkdown: markdownPath,
    sourceCover: coverPath,
    expectedChapters: item.chapter_count,
    updateMode,
    existingMetadataPreserved: Boolean(existing),
    parserAudit: parsed.audit,
    book,
  });
}

const audit = { generatedAt: new Date().toISOString(), root: ROOT, publish: PUBLISH, catalogueStateAvailable: state.available, totals: { prepared: prepared.length, skipped: skipped.length, chapters: prepared.reduce((sum, item) => sum + item.book.chapters.length, 0) }, skipped, books: prepared.map((item) => ({ title: item.book.title, slug: item.book.slug, author: item.book.author, category: item.book.category, tags: item.book.tags, chapters: item.book.chapters.length, expectedChapters: item.expectedChapters, chapterDelta: item.book.chapters.length - item.expectedChapters, cover: item.sourceCover ? basename(item.sourceCover) : null, coverIncluded: Boolean(item.book.coverDataUrl), coverUrl: item.book.coverUrl || null, action: state.available ? (item.updateMode === 'chapters-only' ? 'update' : 'create') : 'unknown', updateMode: state.available ? item.updateMode : 'unknown', existingMetadataPreserved: item.existingMetadataPreserved, integrity: item.book.integrity, coverage: item.parserAudit.coverage, anomalies: item.parserAudit.anomalies, titleOverrides: item.parserAudit.titleOverrides })) };
for (const item of audit.books) console.log(`${item.action.toUpperCase().padEnd(7)} ${item.category.padEnd(14)} ${item.chapters.toString().padStart(3)} ch  ${item.title}`);
for (const item of skipped) console.log(`SKIPPED ${item.title}: ${item.reason}`);
const auditPath = resolve(auditOutIndex >= 0 ? args[auditOutIndex + 1] : (process.env.CLASSICS_AUDIT_OUT || '/tmp/soma-mobile-classics-import-audit.json'));
await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`);
console.log(`Audit written to ${auditPath}`);
if (!PUBLISH) { console.log('Dry run complete; no books uploaded.'); process.exit(0); }

const token = getToken();
if (!token) throw new Error('No import token found. Save it in Keychain as “Soma Book Import Token” or set SOMA_IMPORT_TOKEN (or BOOK_IMPORT_TOKEN).');
let importedBooks = 0;
let importedChapters = 0;
for (const [index, item] of prepared.entries()) {
  const result = await uploadBook(API_URL, token, item);
  importedBooks += Number(result.importedBooks || 0);
  importedChapters += Number(result.importedChapters || 0);
  console.log(`Uploaded ${index + 1}/${prepared.length}: ${item.book.title} (${item.book.chapters.length} chapters)`);
}
console.log(`Completed: ${importedBooks} books, ${importedChapters} chapters.`);
