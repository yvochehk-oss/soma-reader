import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';

function prose(label, count = 120) {
  return Array.from({ length: count }, (_, index) => `${label}-${index + 1}`).join(' ');
}

function runImporter(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/import-mobile-classics.mjs', ...args], {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('dry-run preserves existing metadata, omits its cover, and includes a cover only for a new book', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'soma-classics-import-'));
  const root = join(temporary, 'books');
  const catalogPath = join(temporary, 'catalog.json');
  const auditPath = join(temporary, 'audit.json');
  const existingFolder = join(root, 'mobile_Existing Classic');
  const newFolder = join(root, 'mobile_New Classic');
  await mkdir(existingFolder, { recursive: true });
  await mkdir(newFolder, { recursive: true });
  const manuscript = (title) => `# ${title}\n\n## CHAPTER I. Opening\n\n${prose(title)}\n`;
  await writeFile(join(existingFolder, 'mobile_Existing Classic_full_story.md'), manuscript('Existing Classic'));
  await writeFile(join(newFolder, 'mobile_New Classic_full_story.md'), manuscript('New Classic'));
  await writeFile(join(newFolder, 'mobile_New Classic_cover.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  await writeFile(catalogPath, JSON.stringify([
    { title: 'Existing Classic', author: 'Local Author', chapter_count: 1 },
    { title: 'New Classic', author: 'New Author', chapter_count: 1 },
  ]));

  const server = http.createServer((request, response) => {
    if (request.url?.startsWith('/rest/v1/books')) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify([{
        slug: 'existing-classic', title: 'Online Existing Title', author_name: 'Online Author',
        language_code: 'en', category: 'Romance', description: 'Online description',
        cover_url: 'https://example.test/cover.jpg', tags: ['Classic', 'English Classics'],
        status: 'published', is_featured: true,
      }]));
      return;
    }
    response.writeHead(404).end();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();

  try {
    const result = await runImporter([root, '--audit-out', auditPath], {
      CLASSICS_CATALOG_PATH: catalogPath,
      NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${address.port}`,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test',
    });
    assert.equal(result.code, 0, result.stderr || result.stdout);
    const audit = JSON.parse(await readFile(auditPath, 'utf8'));
    const existing = audit.books.find((book) => book.slug === 'existing-classic');
    const created = audit.books.find((book) => book.slug === 'new-classic');
    assert.equal(existing.updateMode, 'chapters-only');
    assert.equal(existing.coverIncluded, false);
    assert.equal(existing.existingMetadataPreserved, true);
    assert.equal(existing.title, 'Online Existing Title');
    assert.equal(created.updateMode, 'full');
    assert.equal(created.coverIncluded, true);
    assert.equal(created.existingMetadataPreserved, false);
    assert.equal(existing.integrity.verified, true);
    assert.equal(created.integrity.coverageRatio, 1);
  } finally {
    server.close();
    await once(server, 'close');
    await rm(temporary, { recursive: true, force: true });
  }
});
