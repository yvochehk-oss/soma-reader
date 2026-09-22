---
name: publish-soma-books
description: Safely validate, upload, verify, build, deploy, and live-check English or Kiswahili books for the Soma Novel project. Use when adding or updating books, publishing a bilingual pair, refreshing book metadata or covers as part of a full book import, rebuilding static SEO/catalogue artifacts after a book change, or deciding whether a Soma database upload is a complete production release.
---

# Publish Soma Books

Use the repository release orchestrator as the authority. Do not describe a successful database write as a completed release.

## Scope

Work in `/Users/yvoche/AI开发/071_非洲阅读`.

Keep these paths distinct:

- Modern/paired books: `scripts/release-soma-books.mjs`.
- English classics: `scripts/import-mobile-classics.mjs`; retain its integrity/profile gates.
- Cover-only refresh: `scripts/update-mobile-classic-covers.mjs`; do not rewrite chapters or metadata.
- Mobile formatting: hand off only formal artifacts that passed `format-books-mobile` audit.

Read [references/release-contract.md](references/release-contract.md) before publishing or changing metadata rules.

## Required workflow

1. Inspect the exact source root, `git status`, current scripts, and `story_meta.json` files. Preserve unrelated changes.
2. Confirm every intended publication resolves title, author, language, description, cover, canonical category, tags, chapters, and translation pairing.
3. Run a production-equivalent validation without writes:

```bash
npm run release:books -- "/absolute/books/folder" --publish --deploy --dry-run
```

4. Review the generated JSON under `release-audits/`. Stop on any blocked manuscript or metadata error.
5. Only when production publication is explicitly requested, run:

```bash
npm run release:books -- "/absolute/books/folder" --publish --deploy
```

6. Confirm the final audit says `status: "complete"`. Report the exact audit path and book/chapter totals.

The production command must execute these gates in order:

```text
whole-batch source/metadata preflight
→ authenticated import with transient retry
→ token-protected Supabase book/chapter/pairing verification
→ Cloudflare build and local SEO/catalogue verification
→ Wrangler deploy dry-run
→ production deploy
→ live reader page, SEO page, cover and sitemap verification
```

## Safety rules

- Require explicit `--publish` and `--deploy` for a production release.
- Use `--dry-run` for inspection; it must not upload or deploy.
- Store `SOMA_IMPORT_TOKEN` in the environment or macOS Keychain entry `Soma Book Import Token`. Never print, commit, or pass the token as a command argument.
- Keep the publishable Supabase key separate from service-role credentials. Never place a service-role key in scripts or client code.
- Keep the website batch uploader on the same category/tag gate as the CLI; do not restore `other` or an empty tag list for immediate publication.
- Do not bypass metadata, source-integrity, CAPTCHA, authentication, build, or live-verification failures.
- Do not delete or replace existing books to resolve a slug conflict.
- Do not run a cover-only request through the full importer.
- If a later step fails after upload, preserve the audit status `failed-after-database-upload`; use `failed-after-partial-database-upload` when a batch stopped after earlier batches succeeded. Resume only after diagnosing the recorded step.
- Static SEO embeds database metadata and cover URLs. A database or cover change is incomplete until build, deployment, and live `og:image`/sitemap checks pass.

## Completion criteria

A full release is complete only when:

- every requested book is published;
- `total_chapters`, actual rows, and published rows all match;
- language pairing matches `translationOfSlug`;
- cover URLs exist and newly uploaded covers are versioned;
- generated `public/books/<slug>/index.html`, `public/catalog/books.json`, and `public/sitemap.xml` contain every slug;
- Wrangler dry-run and production deployment pass;
- live `/book/<slug>`, `/books/<slug>/`, cover URL, and sitemap checks pass;
- the release audit status is `complete`.
