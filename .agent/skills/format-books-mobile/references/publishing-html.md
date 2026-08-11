# Publishing HTML — Supabase + Cloudflare

Research/architecture update: 2026-08-09.

## Recommended split of responsibilities

```text
format-books-mobile v4.2.2-format-only
        ↓
mobile_book.html ─────────────→ Cloudflare static asset / frontend build
        │
        ├→ mobile_book.assets/ → co-located images/illustrations when present
        │
        └→ mobile_book.content.html → Supabase Postgres content_html
             └→ optional --fragment-asset-prefix for dynamic-site asset URLs

raw EPUB/XHTML/TXT/covers → Supabase Storage or Cloudflare R2 for archive/media
```

## Supabase

Supabase Storage is suitable for file/object storage, but its current Storage quickstart explicitly states that HTML files are returned as plain text for security. Supabase Edge Functions are different: hosted `text/html` responses are rewritten to `text/plain` unless the function is served through a custom domain. Therefore:

- do not make a Storage public URL the book's browser page;
- do use Supabase Postgres for book/chapter metadata and HTML content strings;
- do use Storage/R2 for original archives, covers, downloadable EPUBs, and backups.
- if Edge Functions are ever used to serve HTML directly, require the custom-domain path and still keep a site-side sanitizer/allowlist.

A simple database shape:

```sql
create table books (
  id bigint generated always as identity primary key,
  slug text unique not null,
  title text not null,
  author text,
  language text not null default 'en',
  source_provider text,
  source_id text,
  source_sha256 text,
  content_html text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

For larger books, prefer a `chapters` table with `book_id`, chapter order/title, and `content_html` so the reader loads one chapter at a time.

If tables are exposed through the Data API, enable RLS and create policies matching the actual public/admin access model.

## Cloudflare

Cloudflare Workers Static Assets can serve HTML/CSS/images directly and is the current recommended static-asset path for new Workers projects. A full `mobile_*.html` artifact is therefore directly compatible with Cloudflare static hosting or a static build directory.

For the current dynamic reading site, the common architecture is:

1. route/page runs on Cloudflare;
2. page fetches book/chapter HTML from Supabase;
3. frontend renders only content that passed the formatter security gate and the site's own HTML allowlist/sanitizer;
4. Cloudflare handles the public URL, caching, and frontend assets.

## Why keep both full HTML and fragment

- Full HTML: standalone archival/readable page, simple Cloudflare static deployment.
- Fragment: clean database payload without duplicate `<html>/<head>/<body>` around every chapter/book.
- Publication manifest: provenance and hashes for deployment automation.

## Asset paths in database fragments

For illustrated books, the standalone full HTML can use its sibling `mobile_book.assets/` directory. A database fragment is different because it may render at `/book/<slug>/<chapter>` or another dynamic URL. Use `--fragment-asset-prefix` to rewrite those fragment-only asset references to the Cloudflare/R2/Storage route actually used by the site.

If assets exist and no fragment prefix is supplied, the formatter still writes the fragment for inspection but reports `supabase_database_content_html_ready=false` and `fragment_assets_require_site_mapping=true`.
