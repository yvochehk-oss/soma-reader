# Publish-ready English Novel Mobile Formatter

This local tool produces a website-ready Markdown (`.md`) book source. It uses the mature local sentence-boundary library syntok, protects continuing dialogue, removes internal U+FEFF characters by default, creates a JSON QA report, and emits semantic Markdown headings for books and chapters.

## Install

~~~bash
python -m pip install syntok
~~~

Release mode requires syntok. The explicit fallback mode exists only for local diagnosis and should not be used to publish books.

## Normal publication command

~~~bash
/Users/yvoche/omlx-venv/bin/python format_novel.py full_story.txt \
  --output full_story_mobile.md \
  --report full_story_mobile.qa.json
~~~

The default mode:

- removes internal U+FEFF characters;
- rejects output paths that overwrite the source;
- preserves source paragraphs of 420 characters or fewer;
- groups longer prose around complete sentence boundaries;
- preserves one speaker's unclosed quotation as one paragraph;
- only breaks huge single sentences at safe semicolon, colon, or em-dash points;
- requires a strict QA gate before writing final output.

Final output must have the `.md` extension. Ordinary detected titles become Markdown headings; the verified *A Tale of Two Cities* profile uses this hierarchy:

~~~md
# BOOK THE FIRST

## Recalled to Life

## CHAPTER I

### The Period
~~~

Poetry retains its source line breaks using Markdown hard line breaks. The QA comparison removes only formatter-added Markdown heading markers and verified synthetic labels before checking that the original payload is complete.

## Structure profiles

Use --structure-profile auto (the default) to apply only a verified built-in profile. Currently this supports the supplied Standard Ebooks edition of A Tale of Two Cities:

~~~text
BOOK THE FIRST   Recalled to Life       6 chapters
BOOK THE SECOND  The Golden Thread     24 chapters
BOOK THE THIRD   The Track of a Storm  15 chapters
~~~

The profile runs only when all three front-matter titles, the three verified chapter-one anchors, and the exact 6/24/15 chapter counts are found. Otherwise it leaves the source order unchanged and records a warning. No other book is structurally guessed.

Use --structure-profile none to disable all structure repair. Use --structure-profile tale-of-two-cities to require the profile and fail if its validation does not pass.

## Compatibility switches

~~~text
--keep-zero-width       Preserve U+FEFF; not recommended for publication
--remove-zero-width     Legacy explicit spelling; removal is already default
--engine fallback       Diagnostic-only conservative splitter
--preserve-below-chars 420
--target-chars 360
--max-chars 520
--min-chars 90
--secondary-break-threshold 650
~~~

## QA report

The JSON report records:

- source/output character and word counts after formatter-added Markdown markers are excluded;
- output format (`markdown`);
- number of removed U+FEFF characters;
- quote-protected blocks and prevented bad dialogue breaks;
- safe long-sentence breaks;
- selected structure profile;
- moved volume titles and inserted book/chapter labels;
- the integrity validation mode and warnings.

For ordinary books, strict validation requires exact canonical equality after whitespace changes. For an approved structure profile, titles are deliberately moved and labels inserted; the report instead verifies that the complete original character payload remains present after removing generated labels.
