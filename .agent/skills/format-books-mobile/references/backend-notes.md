# Backend notes — v4.2.2-format-only HTML-native

## Design principle

The formatter remains **Agent-first**. Python standard-library helpers are not a replacement for semantic reading.

## Why HTML-native

This standalone formatter consumes structured HTML already produced by an acquisition/normalization step. It emits HTML, never Markdown/TXT.

The primary formatter edits explicit source `<p>` elements by inserting new paragraph boundaries at raw source offsets. It does not serialize an entire DOM and therefore does not casually normalize entities, attribute ordering, inline emphasis, or unrelated markup.

## Safe inline-markup strategy

The preparer builds a decoded visible-text map for each `<p>` while retaining raw HTML offsets. Sentence candidates are accepted as paragraph boundaries only when the raw offset is outside active inline markup, or when only immediate closing inline tags remain after the punctuation.

This deliberately prefers refusing an unsafe split over closing/reopening arbitrary tags.

## Existing paragraph boundaries

Separate source `<p>` elements are hard boundaries. v4.2.1 never merges them. This preserves the stronger semantic structure of Standard Ebooks/Gutenberg HTML and keeps the Agent focused on mobile subdivisions.

## Upstream source contract

Source acquisition is intentionally outside this skill. The formatter accepts `working_source.html`; when a sibling `source_manifest.json` exists, `prepare` verifies its `selected.working_source_sha256` before editing. Assets listed in provenance are re-verified and copied during publication.

## Integrity model

The provenance chain is continuous rather than a set of advisory hashes:

1. upstream acquisition/normalization may record the `working_source.html` hash and per-asset inventory;
2. `prepare` verifies that provenance when present and always locks the actual source bytes;
3. `render` re-verifies the source bytes and any recorded source asset inventory;
4. final QA compares visible-text payload hashes and records full HTML / fragment / per-asset hashes;
5. formal `audit` re-verifies publication artifacts by raw file bytes plus asset hashes.

The renderer may add `<p>` boundaries, remove duplicate identifiers from continuation start tags, and inject mobile CSS. Integrity comparison collapses whitespace runs introduced by HTML formatting but retains a separator, so word-boundary changes such as `New York` → `NewYork` fail.

## HTML security gate

Formal release rejects:

- `script`, `iframe`, `object`, `embed`, `form`;
- event-handler attributes (`on*`);
- `javascript:` URLs;
- dangerous URL schemes such as `vbscript:` and active HTML/SVG data URLs;
- `<base>` and meta-refresh redirects;
- duplicate `id` / `xml:id` values;
- unreliable paragraph structure;
- misnested/unclosed inline markup inside editable prose paragraphs.

This is a production guardrail for external public-domain source material, not a substitute for website-side HTML allowlisting/sanitization.

## Publication handoff

Full HTML is intended for Cloudflare/static serving. Optional `<main>/<body>` fragment output is intended for a Supabase Postgres `text` field (`content_html`). `publication.json` records hashes and provenance for the publishing step. The QA/publication metadata inventories every copied asset by relative path, size, and SHA-256. Formal audit verifies the exact asset directory inventory (including unexpected files) and the publication-manifest hash when emitted. Existing destination asset directories are never recursively deleted; they are reused only if their hash inventory already matches the source assets exactly.

When localized book assets exist, render copies them beside the final file into `<output-stem>.assets/` and rewrites the output references. This prevents a final HTML file moved outside the acquisition directory from silently losing illustrations.
