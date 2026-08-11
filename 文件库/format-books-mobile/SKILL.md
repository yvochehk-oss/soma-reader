---
name: format-books-mobile
description: Reformat any English or Swahili narrative book in UTF-8 TXT or Markdown, including classics, licensed manuscripts, translations, web fiction, and newly written novels, into a source-faithful AI-reviewed mobile-reading Markdown edition. Use when Codex must identify and isolate important dialogue, description, or interior thought; vary paragraph rhythm; enforce phone-friendly paragraph limits; preserve every source character; or audit a mobile edition. The workflow may use Codex or another capable model such as Antigravity for semantic review, while the deterministic renderer and integrity gate remain authoritative.
---

# Format Books Mobile

Create a phone-first edition of the current English or Swahili book without rewriting, translating, modernizing, summarizing, or silently losing source text. Never carry plot judgments, emphasis choices, or style assumptions from another book.

## Required workflow

1. Confirm the exact UTF-8 TXT or Markdown source and create a new source-adjacent work directory. Preserve its real format; do not rename Markdown to TXT merely for processing. Never reuse the source path for output, report, manifest, or decisions.
2. Run `scripts/mobile_book_formatter.py prepare` with `syntok`. Use `fallback` only for diagnostics.
3. Read [references/decision-protocol.md](references/decision-protocol.md) completely.
4. Review every packet in numeric order and read every unit, not only heuristic candidates. Write one `reviewed=true` decision file per packet.
5. Mark every important dialogue sentence, important descriptive sentence, and important interior or psychological sentence with its matching pivotal category. These categories are mandatory standalone paragraphs even when the sentence contains only one word.
6. Render without `--allow-unreviewed` for a formal edition. Use that switch only for a clearly labelled internal preview.
7. Inspect every entry in `emergency_split_review`. A source sentence longer than the hard maximum is the only case where a pivotal sentence may require model-selected clause breaks. Rerun with `--ack-emergency-splits` only after inspecting every break.
8. Run `audit --require-formal`, then independently inspect the beginning, middle, end, all pivotal one-sentence paragraphs, and every warning.
9. Deliver the Markdown and QA report together and state whether it is a formal model-reviewed release or a preview.

## Commands

```bash
python scripts/mobile_book_formatter.py prepare SOURCE.txt \
  --workspace SOURCE_mobile_work

python scripts/mobile_book_formatter.py render \
  --manifest SOURCE_mobile_work/manifest.json \
  --output SOURCE_mobile.md \
  --report SOURCE_mobile.qa.json

python scripts/mobile_book_formatter.py audit \
  --report SOURCE_mobile.qa.json --require-formal
```

Defaults are 180, 100, 240, 140, 280, and 160 characters including spaces, with a 300-character soft maximum and a 360-character hard maximum. These apply to both English and Swahili because both use Latin-script mobile line wrapping. Change them only when the user requests another density or real mobile rendering justifies it.

## Non-negotiable pivotal rule

- `pivotal_dialogue`, `pivotal_description`, and `pivotal_interiority` always force a paragraph break before and after the sentence.
- No minimum length applies. `“No!”`, `“Go!”`, `“Hapana!”`, and `“Nenda!”` may each be a complete paragraph when important in context.
- A pivotal decision cannot set `standalone=false` or `keep_with_next=true`; the renderer must reject either conflict.
- Judge importance from the current scene and whole-book context. Shortness, quotation marks, or exclamation marks alone do not prove importance.
- Preserve dialogue attribution with the line when both belong to the same source sentence and separating them would change or orphan the construction.

## Editorial rules

- Preserve words, punctuation, capitalization, and character order exactly. Only whitespace, paragraph boundaries, and synthetic Markdown heading markers may change.
- For Markdown input, close and reopen strong-emphasis markers synthetically when a new pivotal paragraph cuts through one source emphasis span. The payload checksum must still cover only original characters.
- Preserve ordinary dialogue and narrative flow; do not convert every sentence into a one-line paragraph.
- Use `scene_turn` for a boundary-level transition. It does not automatically carry the mandatory standalone rule.
- Preserve quiet passages and longer movement. Phone-first rhythm must not erase the author's voice.
- Never claim formal completion while packets remain unreviewed, prose exceeds the hard maximum, integrity is unconfirmed, or warnings remain unchecked.

## Acceptance gates

- `content_integrity` must be `true`.
- `prose_over_hard_max` must be `0`.
- `unreviewed_packets` must be empty.
- Every pivotal unit must render as a standalone paragraph, regardless of length.
- `audit --require-formal` must pass against unchanged source and output files.
- Treat `nonprose_over_hard_max`, `emergency_split_review`, and long same-band rhythm warnings as manual-review queues.
