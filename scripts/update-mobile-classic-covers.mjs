#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootArg = process.argv.slice(2).find((value) => !value.startsWith('--'));
const ROOT = resolve(rootArg || '/Users/yvoche/AI开发/000.非洲最终正文/0.2英文经典手机版');
const API_URL = process.env.SOMA_COVERS_API || 'https://somanovel.uk/api/internal/book-covers';
const CATALOG_PATH = fileURLToPath(new URL('../classics_catalog.json', import.meta.url));

function slugify(value) { return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }
function getToken() { if (process.env.SOMA_IMPORT_TOKEN) return process.env.SOMA_IMPORT_TOKEN; if (process.env.BOOK_IMPORT_TOKEN) return process.env.BOOK_IMPORT_TOKEN; try { return execFileSync('security', ['find-generic-password', '-s', 'Soma Book Import Token', '-w'], { encoding: 'utf8' }).trim(); } catch { return ''; } }
async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }
async function findCover(folder, preferred) {
  const names = await readdir(folder);
  const name = preferred && names.includes(preferred) ? preferred : names.find((entry) => entry.endsWith('_cover.jpg'));
  return name ? join(folder, name) : null;
}
async function hasMarkdown(folder) {
  try { return (await readdir(folder)).some((entry) => entry.endsWith('_full_story.md')); } catch { return false; }
}

const catalog = await readJson(CATALOG_PATH);
const covers = [];
const skipped = [];
for (const item of catalog) {
  const folder = join(ROOT, `mobile_${item.title}`);
  if (!(await hasMarkdown(folder))) { skipped.push(`${item.title} (missing Markdown正文)`); continue; }
  let coverPath = null;
  try { coverPath = await findCover(folder, item.cover_image); } catch { /* handled below */ }
  if (!coverPath) { skipped.push(item.title); continue; }
  const bytes = await readFile(coverPath);
  covers.push({ slug: slugify(item.title), title: item.title, source: coverPath, coverDataUrl: `data:image/jpeg;base64,${bytes.toString('base64')}` });
}
console.log(`Prepared ${covers.length} cover updates; skipped ${skipped.length}.`);
if (skipped.length) console.log(`Skipped: ${skipped.join(', ')}`);
if (!process.argv.includes('--publish')) { console.log('Dry run complete; no covers uploaded.'); process.exit(0); }
const token = getToken();
if (!token) throw new Error('No import token found.');
let updated = 0;
for (let index = 0; index < covers.length; index += 20) {
  const batch = covers.slice(index, index + 20);
  const response = await fetch(API_URL, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ covers: batch }) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Cover batch ${Math.floor(index / 20) + 1} failed (${response.status}): ${result.error ?? 'Unknown error'}`);
  updated += Number(result.updatedCovers || 0);
  console.log(`Updated covers ${Math.min(index + 20, covers.length)}/${covers.length}.`);
}
console.log(`Completed: ${updated} cover updates.`);
