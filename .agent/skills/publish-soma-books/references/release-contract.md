# Soma book release contract

## Source metadata

Standard book folders should contain `story_meta.json`. The machine-readable schema is:

`/Users/yvoche/AI开发/071_非洲阅读/scripts/schemas/story-meta.schema.json`

Resolved published metadata must include:

- `title`
- `author`
- `language`: `en` or `sw`
- `description`
- `category`
- `tags`
- a matching JPG, PNG, or WebP cover
- at least one valid chapter
- `translation_of_slug` when the translation is not paired automatically

Allowed categories are exactly:

- Romance
- Thriller
- Sci-Fi
- Historical
- Fantasy
- Contemporary
- Urban Fantasy

Use 1–12 specific tags, each at most 40 characters. Do not use a generic synopsis or silently assign a default genre. CLI `--category`, `--tags`, `--description`, and `--author` may supply missing legacy metadata, but the resolved publication must pass the same gate.

## Command modes

`scripts/upload-soma-books.mjs` is the low-level importer.

- `--dry-run`: validate only.
- `--draft`: explicit database draft upload.
- `--publish`: explicit published upload.
- Omitting all three must not write.

`scripts/release-soma-books.mjs` is the production orchestrator.

- Require `--publish`.
- Require `--deploy` unless `--dry-run` is present.
- Generate a JSON audit by default under `release-audits/`.
- Retry only transient HTTP statuses (`408`, `425`, `429`, and `5xx`) up to five attempts.
- Do not retry permanent metadata/authentication errors.
- Verify uploaded rows through the token-protected `GET /api/internal/book-import?slug=...` audit endpoint; do not depend on public RLS visibility for the release decision.

## Failure boundary

The Supabase import is idempotent by slug and stages each full import as draft before finalizing it. Cloudflare deployment is a separate system and cannot share a database transaction. Therefore preserve the release audit after every step. If build or deployment fails after upload, report the exact partial state and rerun only after the cause is fixed.

## SEO contract

A published database row is immediately available to dynamic readers, but static discovery artifacts are generated during `npm run cf:build`. A complete release must refresh and verify:

- `public/catalog/books.json`
- `public/books/<slug>/index.html`
- `public/sitemap.xml`
- Open Graph `og:image`
- Schema.org `Book.image`
- live reader and SEO routes
