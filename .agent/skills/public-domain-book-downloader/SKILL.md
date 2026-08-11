---
name: public-domain-book-downloader
description: Standalone local skill for acquiring public-domain English ebooks. Prefer Standard Ebooks structured XHTML, then Gutendex/Project Gutenberg HTML via mirrors, and UTF-8 TXT only as a fallback. Preserve raw source files and assets, normalize to working_source.html, write source_manifest.json, and optionally check a local classics_catalog.json before downloading to avoid duplicate work.
---

# Public Domain Book Downloader v1.0.0

This is the **download/source-acquisition module** extracted from `download-reformat-books-mobile v4.2.1`.
It does **not** perform mobile paragraph editing, final formatting, QA publication, Supabase upload, Cloudflare deployment, or Google Drive registry mutation.

## Source priority

1. Standard Ebooks public Git/XHTML source.
2. Gutendex metadata + Project Gutenberg HTML from a mirror.
3. Project Gutenberg UTF-8 TXT fallback.
4. Deterministic Gutenberg mirror URLs derived from the Gutenberg ID.

HTML/XHTML is always preferred over TXT. Standard Ebooks assets are copied locally. Gutenberg HTML image/media references are localized when possible.

## TXT fallback safety

The v1.0.0 downloader includes the v4.2.1 Gutenberg hard-wrap fix. It can merge physical 60–80-column prose wrapping inside a blank-line paragraph block while conservatively preserving headings, indented material, verse/poetry, and line-oriented content.

## Required output

A successful download directory normally contains:

- `raw/` — immutable downloaded source/archive.
- `working_source.html` — normalized HTML for downstream processing.
- `assets/` — localized images/media when present.
- `source_manifest.json` — provider, URL, source hashes, normalization details and errors before success.

## Local use

```bash
python3 scripts/book_source_fetcher.py fetch \
  --title "The Wind in the Willows" \
  --author "Kenneth Grahame" \
  --out ./downloads/the-wind-in-the-willows \
  --allow-without-completion-catalog
```

If you have a fresh local copy of the canonical registry, prefer:

```bash
python3 scripts/book_source_fetcher.py fetch \
  --title "The Wind in the Willows" \
  --author "Kenneth Grahame" \
  --out ./downloads/the-wind-in-the-willows \
  --completion-catalog ./classics_catalog.json
```

If the book is already present in the catalog, the downloader exits with `status: already-completed` and does not download it.

## Normalize an already-downloaded source

```bash
python3 scripts/book_source_fetcher.py normalize ./book.xhtml \
  --title "The Wind in the Willows" \
  --author "Kenneth Grahame" \
  --out ./normalized
```

For Gutenberg TXT:

```bash
python3 scripts/book_source_fetcher.py normalize ./pg27805.txt \
  --title "The Wind in the Willows" \
  --author "Kenneth Grahame" \
  --strip-gutenberg-boilerplate \
  --out ./normalized
```

## Canonical Delivery & Auto-Upload Specification

For formal operations, the downloader enforces two mandatory rules:

1. **Pre-check Catalog (De-duplication)**:
   - Before attempting any network requests or output directory mutations, the script MUST check the canonical `classics_catalog.json` (Google Drive File ID: `1Bal3bdZMCtXJma6q6Z--zNFvJPC2oeV-` or local `--completion-catalog`).
   - If the book is matched as already completed, the downloader MUST skip downloading and exit with `status: already-completed`.

2. **Google Drive Sync (`英文经典2`) & Non-Destructive Catalog Merge**:
   - Upon successful download and HTML normalization, the downloader automatically uploads the complete book directory to Google Drive folder **`英文经典2`** (ID: `168d_X_V_lB2Pv4DTPyTSGipY2yvSeT5f`).
   - The uploaded directory MUST contain all 4 delivery items:
     1. `raw/`
     2. `assets/` (if present)
     3. `working_source.html`
     4. `source_manifest.json` (MUST be written before upload begins)
   - **Non-Destructive Catalog Merge & Priority Lock Rule**:
     - Canonical Google Drive file ID: `1Bal3bdZMCtXJma6q6Z--zNFvJPC2oeV-`.
     - Downloader MUST fetch the latest server JSON before updating, perform field-level merge without overwriting `mobile_html` or `mobile_markdown` status or publication/QA fields, check optimistic concurrency via `modifiedTime`, write back, and perform a read-back verification. State priority: `mobile_html / mobile_markdown > html_source > download_pending`.

## macOS convenience

- Double-click `download_book.command` and enter title/author.
- Or use Terminal:

```bash
./download_book.sh "The Wind in the Willows" "Kenneth Grahame" ./downloads/wind
```

## Runtime dependencies

Python 3 standard library only. No pip install is required (Google Drive API upload requires standard authorized `token.json` if sync is enabled).
