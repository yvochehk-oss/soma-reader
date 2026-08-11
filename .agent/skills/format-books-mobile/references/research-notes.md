# Open-source research adopted in v3

Research date: 2026-08-09.

This skill does **not** copy or vendor source code from the projects below. It adopts selected architectural ideas and reimplements only the small amount of functionality needed for this Agent-first workflow with Python's standard library.

## pySBD / Pragmatic Segmenter

Project: https://github.com/nipunsadvilkar/pySBD

Useful idea: sentence-boundary detection should explicitly protect pragmatic edge cases (abbreviations, initials, punctuation ambiguity) rather than treating every period as a sentence end. pySBD describes itself as a rule-based SBD tool and is based on Pragmatic Segmenter's Golden Rules approach.

Adopted in v3: a small transparent set of built-in boundary protections suitable for English/Swahili book preparation. The candidate splitter is intentionally subordinate to Agent decisions.

## syntok

Project: https://github.com/fnl/syntok

Useful idea: preserve token spacing/offsets so source text can be exactly reconstructed and original offsets remain meaningful.

Adopted in v3: every unit carries absolute `source_start/source_end`, must equal the exact source slice, and is checked by global span coverage before and after Agent decisions.

## SaT / wtpsplit

Project: https://github.com/segment-any-text/wtpsplit

Useful idea: sentence/semantic segmentation can be treated as an adaptable model problem, including poorly punctuated text. The project also separates sentence segmentation from broader semantic units.

Adopted in v3: the **Agent** is explicitly the semantic decision layer. We do not bundle/download SaT models because that would defeat the zero-dependency goal and duplicate the Agent's role.

## text-splitter

Project: https://github.com/benbrandt/text-splitter

Useful idea: prefer higher-level semantic boundaries over lower-level fallback boundaries, and do not cross stronger document structure merely to hit a size target.

Adopted in v3: structural blocks outrank prose splitting; punctuation candidates outrank sparse whitespace fallback candidates; soft length never overrides semantic judgment.

## LangChain ExperimentalMarkdownSyntaxTextSplitter

Project file: https://github.com/langchain-ai/langchain/blob/master/libs/text-splitters/langchain_text_splitters/markdown.py

Useful idea: preserve original whitespace/formatting while extracting Markdown structure, and explicitly recognize code blocks and headings.

Adopted in v3: fenced code/front matter are protected before blank-line splitting; headings, blockquotes, tables, lists, footnotes and HTML blocks remain structural, not prose-editing targets.

## Standard Ebooks

Manual: https://github.com/standardebooks/manual
Tools: https://github.com/standardebooks/tools

Useful idea: separate desired ebook structure/semantics/typography from the mechanics used to produce it, and validate the final artifact against explicit rules.

Adopted in v3: the skill states declarative acceptance gates, keeps semantic editing separate from deterministic verification, and requires a final formal audit.

## Deliberately not added

- Full pySBD/YASBD source: unnecessary size/complexity for an Agent-led workflow.
- phrasplit: Agent can judge exact punctuation/whitespace candidates directly.
- wtpsplit/SaT models: adds model/runtime dependencies and duplicates the connected Agent's semantic role.
- spaCy/Stanza: large dependency trees not justified for source-faithful paragraph layout.
- Markdown parser libraries: v3 only needs a conservative set of protected structures and exact-slice guarantees; a full parser would add dependency risk.
