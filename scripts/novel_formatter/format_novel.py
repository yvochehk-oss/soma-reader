#!/usr/bin/env python3
"""Publish-ready English-fiction formatter.

Default output is publish-ready Markdown: internal U+FEFF characters are
removed, syntok is required, dialogue remains intact, and a verified book
profile can repair known misplaced volume/chapter metadata.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path

try:
    from syntok import segmenter as _syntok
    SYNTOK_AVAILABLE = True
except ImportError:
    _syntok = None
    SYNTOK_AVAILABLE = False

SCENE_RE = re.compile(r"^\s*(?:\*\s*){3,}$|^\s*(?:[-_=])(?:\s*[-_=]){2,}\s*$")
HEADING_RE = re.compile(
    r"^\s*(?:book|part|volume|chapter|prologue|epilogue|preface|introduction|contents)\b.*$",
    re.IGNORECASE,
)
LETTER_RE = re.compile(r"^\s*(?:dear\s+|my\s+dear\s+|yours\s+(?:truly|sincerely))\b", re.I)
LIST_RE = re.compile(r"^\s*(?:[-*•]\s+|\d+[.)]\s+)")
TITLE_MINOR_WORDS = {"a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "nor", "of", "on", "or", "the", "to", "with", "yet"}

TALE_PROFILE = {
    "id": "tale-of-two-cities",
    "volume_titles": ["Recalled to Life", "The Golden Thread", "The Track of a Storm"],
    "chapter_one_titles": ["The Period", "Five Years Later", "In Secret"],
    "chapter_counts": [6, 24, 15],
    "book_labels": ["BOOK THE FIRST", "BOOK THE SECOND", "BOOK THE THIRD"],
}


@dataclass
class Block:
    kind: str
    text: str
    source_index: int | None


@dataclass
class Metrics:
    input_file: str
    output_file: str
    output_format: str
    sentence_engine: str
    input_chars: int
    output_chars: int
    input_non_ws: int
    output_non_ws: int
    input_words: int
    output_words: int
    input_blocks: int
    output_blocks: int
    unchanged_short_blocks: int
    quote_protected_blocks: int
    quote_breaks_prevented: int
    secondary_sentence_breaks: int
    removed_zero_width: int
    structure_profile: str
    structure_edits: dict[str, int]
    content_integrity_mode: str
    warnings: list[str]
    errors: list[str]


def canonical(text: str) -> str:
    return re.sub(r"\s+", "", text)


def word_count(text: str) -> int:
    return len(re.findall(r"\b[\w’'-]+\b", text, re.UNICODE))


def normalize_inline(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def roman(number: int) -> str:
    symbols = ((1000, "M"), (900, "CM"), (500, "D"), (400, "CD"), (100, "C"), (90, "XC"), (50, "L"), (40, "XL"), (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I"))
    result = []
    for value, token in symbols:
        count, number = divmod(number, value)
        result.append(token * count)
    return "".join(result)


def is_title_case_heading(text: str) -> bool:
    words = re.findall(r"[A-Za-z]+(?:['’][A-Za-z]+)?", text)
    meaningful = [word for word in words if word.lower() not in TITLE_MINOR_WORDS]
    if not meaningful or len(text) > 96 or len(words) > 12 or re.search(r"[.!?;:]", text):
        return False
    return all(word.isupper() or word[:1].isupper() for word in meaningful if word.lower() not in {"'s", "’s"})


def classify(text: str) -> str:
    stripped = text.strip()
    if SCENE_RE.match(stripped):
        return "scene_break"
    if HEADING_RE.match(stripped) or is_title_case_heading(stripped):
        return "heading"
    if LETTER_RE.match(stripped):
        return "letter"
    if LIST_RE.match(stripped):
        return "list"
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if len(lines) >= 2 and sum(word_count(line) <= 8 for line in lines) / len(lines) >= 0.8:
        return "poetry"
    return "prose"


def parse_blocks(text: str) -> list[Block]:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    return [
        Block(classify(raw), raw.strip(), index)
        for index, raw in enumerate(re.split(r"\n\s*\n", normalized))
        if raw.strip()
    ]


def quote_depth(text: str) -> int:
    """Double-quote depth. Apostrophes deliberately do not count as dialogue."""
    depth = 0
    straight_open = False
    for char in text:
        if char in "“«":
            depth += 1
        elif char in "”»":
            depth = max(0, depth - 1)
        elif char == '"':
            straight_open = not straight_open
            depth = depth + 1 if straight_open else max(0, depth - 1)
    return depth


def fallback_sentences(text: str) -> list[str]:
    """Explicit fallback only; release output should use syntok."""
    result, start, index = [], 0, 0
    while index < len(text):
        char = text[index]
        if char in ".!?":
            protected = char == "." and (
                (index + 1 < len(text) and text[index + 1] == ".")
                or (index and index + 1 < len(text) and text[index - 1].isalnum() and text[index + 1].isalnum())
            )
            if not protected:
                end = index + 1
                while end < len(text) and text[end] in '"”’)]':
                    end += 1
                if end == len(text) or text[end].isspace():
                    result.append(text[start:end].strip())
                    start = end
                    while start < len(text) and text[start].isspace():
                        start += 1
                    index = start
                    continue
        index += 1
    tail = text[start:].strip()
    if tail:
        result.append(tail)
    return result


def sentences(text: str) -> list[str]:
    if SYNTOK_AVAILABLE:
        result: list[str] = []
        for paragraph in _syntok.process(text):
            for sentence in paragraph:
                start = sentence[0].offset
                last = sentence[-1]
                # Keep syntok's boundary decision, but slice source characters.
                result.append(text[start:last.offset + len(last.value)].strip())
        if result:
            return result
    return fallback_sentences(text)


def safe_secondary_breaks(sentence: str, threshold: int, target: int, minimum: int) -> list[str]:
    """Break only huge single sentences at safe ;, :, or em-dash boundaries."""
    if len(sentence) <= threshold or quote_depth(sentence):
        return [sentence]
    candidates: list[int] = []
    quoted = parentheses = 0
    straight_open = False
    for index, char in enumerate(sentence):
        if char in "“«":
            quoted += 1
        elif char in "”»":
            quoted = max(0, quoted - 1)
        elif char == '"':
            straight_open = not straight_open
            quoted = quoted + 1 if straight_open else max(0, quoted - 1)
        elif char == "(":
            parentheses += 1
        elif char == ")":
            parentheses = max(0, parentheses - 1)
        elif not quoted and not parentheses and char in ";:—":
            candidates.append(index + 1)
    if not candidates:
        return [sentence]

    pieces, start = [], 0
    while len(sentence) - start > threshold:
        eligible = [point for point in candidates if start + minimum <= point <= start + target]
        if not eligible:
            eligible = [point for point in candidates if point > start + minimum]
        if not eligible:
            break
        point = min(eligible, key=lambda value: abs(value - (start + target)))
        pieces.append(sentence[start:point].strip())
        start = point
    tail = sentence[start:].strip()
    if tail:
        pieces.append(tail)
    if len(pieces) > 1 and len(pieces[-1]) < minimum:
        pieces[-2] = f"{pieces[-2]} {pieces[-1]}"
        pieces.pop()
    return pieces


def has_cross_sentence_quote(sentences_: list[str]) -> bool:
    accumulated = ""
    for sentence in sentences_:
        accumulated += sentence
        if quote_depth(accumulated):
            return True
    return False


def format_prose(original: str, preserve_below: int, target: int, maximum: int, minimum: int, long_sentence_threshold: int) -> tuple[list[str], dict[str, int]]:
    text = normalize_inline(original)
    stats = {"unchanged_short_blocks": 0, "quote_protected_blocks": 0, "quote_breaks_prevented": 0, "secondary_sentence_breaks": 0}
    if len(text) <= preserve_below:
        stats["unchanged_short_blocks"] = 1
        return [text], stats
    source_sentences = sentences(text)
    if has_cross_sentence_quote(source_sentences):
        stats["quote_protected_blocks"] = 1
        stats["quote_breaks_prevented"] = max(0, len(source_sentences) - 1)
        return [text], stats

    units: list[str] = []
    for sentence in source_sentences:
        split = safe_secondary_breaks(sentence, long_sentence_threshold, target, minimum)
        stats["secondary_sentence_breaks"] += len(split) - 1
        units.extend(split)

    output, current, current_length = [], [], 0
    for unit in units:
        unit_length = len(unit)
        if current and current_length + 1 + unit_length > maximum:
            output.append(" ".join(current))
            current, current_length = [], 0
        current.append(unit)
        current_length += unit_length + (1 if current_length else 0)
        if current_length >= target:
            output.append(" ".join(current))
            current, current_length = [], 0
    if current:
        output.append(" ".join(current))
    if len(output) >= 2 and len(output[-1]) < minimum and len(output[-2]) + 1 + len(output[-1]) <= maximum + minimum:
        output[-2] = f"{output[-2]} {output[-1]}"
        output.pop()
    return output, stats


def repair_tale_of_two_cities(blocks: list[Block]) -> tuple[list[Block], dict[str, int], list[str], list[str]]:
    """Move only the three verified front-matter volume titles and add labels."""
    edits = {"moved_volume_titles": 0, "inserted_book_labels": 0, "inserted_chapter_labels": 0}
    warnings: list[str] = []
    errors: list[str] = []
    titles = TALE_PROFILE["volume_titles"]
    anchors = TALE_PROFILE["chapter_one_titles"]
    if len(blocks) < 4 or [block.text for block in blocks[:3]] != titles:
        errors.append("A Tale of Two Cities profile rejected: expected three volume titles at the beginning")
        return blocks, edits, warnings, errors
    remaining = blocks[3:]
    anchor_positions = [index for index, block in enumerate(remaining) if block.text in anchors]
    if [remaining[index].text for index in anchor_positions] != anchors:
        errors.append("A Tale of Two Cities profile rejected: chapter-one anchors are missing or out of order")
        return blocks, edits, warnings, errors

    result: list[Block] = []
    volume_index = -1
    chapter_number = 0
    actual_counts = [0, 0, 0]
    for block in remaining:
        if block.text in anchors:
            volume_index = anchors.index(block.text)
            chapter_number = 0
            result.append(Block("book_label", TALE_PROFILE["book_labels"][volume_index], None))
            result.append(Block("book_title", titles[volume_index], None))
            edits["inserted_book_labels"] += 1
        if block.kind == "heading":
            if volume_index < 0:
                errors.append("A Tale of Two Cities profile rejected: chapter heading found before Book One")
                return blocks, {"moved_volume_titles": 0, "inserted_book_labels": 0, "inserted_chapter_labels": 0}, warnings, errors
            chapter_number += 1
            actual_counts[volume_index] += 1
            result.append(Block("chapter_label", f"CHAPTER {roman(chapter_number)}", None))
            edits["inserted_chapter_labels"] += 1
        result.append(block)
    if actual_counts != TALE_PROFILE["chapter_counts"]:
        errors.append(f"A Tale of Two Cities profile rejected: expected chapter counts {TALE_PROFILE['chapter_counts']}, found {actual_counts}")
        return blocks, {"moved_volume_titles": 0, "inserted_book_labels": 0, "inserted_chapter_labels": 0}, warnings, errors
    edits["moved_volume_titles"] = 3
    return result, edits, warnings, errors


def apply_structure_profile(blocks: list[Block], requested: str) -> tuple[list[Block], str, dict[str, int], list[str], list[str]]:
    empty = {"moved_volume_titles": 0, "inserted_book_labels": 0, "inserted_chapter_labels": 0}
    if requested == "none":
        return blocks, "none", empty, [], []
    matches_tale = len(blocks) >= 3 and [block.text for block in blocks[:3]] == TALE_PROFILE["volume_titles"]
    if requested == "auto" and not matches_tale:
        return blocks, "none", empty, ["no verified structure profile matched; source heading order was preserved"], []
    repaired, edits, warnings, errors = repair_tale_of_two_cities(blocks)
    if errors and requested == "auto":
        return blocks, "none", empty, warnings + errors, []
    return repaired, TALE_PROFILE["id"], edits, warnings, errors


def markdown_heading(block: Block) -> str:
    """Render a semantic structural block without changing its text payload."""
    if block.kind == "book_label":
        return f"# {block.text.strip()}"
    if block.kind in {"book_title", "chapter_label"}:
        return f"## {block.text.strip()}"
    raise ValueError(f"not a heading block: {block.kind}")


def format_book(blocks: list[Block], preserve_below: int, target: int, maximum: int, minimum: int, long_sentence_threshold: int) -> tuple[str, dict[str, int]]:
    result: list[str] = []
    stats = {"unchanged_short_blocks": 0, "quote_protected_blocks": 0, "quote_breaks_prevented": 0, "secondary_sentence_breaks": 0}
    has_explicit_chapter_labels = any(block.kind == "chapter_label" for block in blocks)
    for block in blocks:
        if block.kind == "prose":
            formatted, local = format_prose(block.text, preserve_below, target, maximum, minimum, long_sentence_threshold)
            result.extend(formatted)
            for key, value in local.items():
                stats[key] += value
        elif block.kind == "poetry":
            # Markdown ignores a lone newline. Two trailing spaces preserve
            # every verse line in browsers and Markdown-to-HTML converters.
            lines = [line.rstrip() for line in block.text.splitlines()]
            result.append("  \n".join(lines))
        elif block.kind in {"letter", "list"}:
            result.append(normalize_inline(block.text))
        elif block.kind in {"book_label", "book_title", "chapter_label"}:
            result.append(markdown_heading(block))
        elif block.kind == "heading":
            prefix = "###" if has_explicit_chapter_labels else "##"
            result.append(f"{prefix} {block.text.strip()}")
        else:
            result.append(block.text.strip())
    return "\n\n".join(result) + ("\n" if result else ""), stats


def remove_markdown_markup(text: str) -> str:
    """Remove formatter-added Markdown markers before payload QA comparison."""
    text = re.sub(r"(?m)^#{1,6}[ \t]+", "", text)
    return re.sub(r"(?m)^(?:BOOK THE (?:FIRST|SECOND|THIRD)|CHAPTER [IVXLCDM]+)\s*\n?", "", text)


def main() -> int:
    global SYNTOK_AVAILABLE
    parser = argparse.ArgumentParser(description="Publish-ready Markdown formatter for English fiction")
    parser.add_argument("input", type=Path, help="UTF-8 source text")
    parser.add_argument("-o", "--output", type=Path, required=True)
    parser.add_argument("--report", type=Path, help="write JSON QA report")
    parser.add_argument("--engine", choices=["syntok", "fallback"], default="syntok")
    parser.add_argument("--structure-profile", choices=["auto", "none", "tale-of-two-cities"], default="auto")
    parser.add_argument("--preserve-below-chars", type=int, default=420)
    parser.add_argument("--target-chars", type=int, default=360)
    parser.add_argument("--max-chars", type=int, default=520)
    parser.add_argument("--min-chars", type=int, default=90)
    parser.add_argument("--secondary-break-threshold", type=int, default=650)
    zero_group = parser.add_mutually_exclusive_group()
    zero_group.add_argument("--keep-zero-width", action="store_true", help="keep internal U+FEFF characters; not recommended for publication")
    zero_group.add_argument("--remove-zero-width", action="store_true", help="legacy explicit form; removal is now the default")
    parser.add_argument("--verify-integrity", choices=["strict", "warn", "off"], default="strict")
    args = parser.parse_args()

    if not args.input.is_file():
        print(f"error: input file not found: {args.input}", file=sys.stderr)
        return 2
    if args.input.resolve() == args.output.resolve():
        print("error: output path must differ from input path", file=sys.stderr)
        return 2
    if args.output.suffix.lower() != ".md":
        print("error: final publication output must use the .md extension", file=sys.stderr)
        return 2
    if not (0 < args.min_chars <= args.target_chars <= args.max_chars < args.secondary_break_threshold):
        print("error: require 0 < min <= target <= max < secondary-break-threshold", file=sys.stderr)
        return 2
    if args.engine == "syntok" and not SYNTOK_AVAILABLE:
        print("error: syntok is required for release output; run: python -m pip install syntok", file=sys.stderr)
        return 2

    raw = args.input.read_text(encoding="utf-8-sig")
    removed_zero_width = 0 if args.keep_zero_width else raw.count("\ufeff")
    source = raw if args.keep_zero_width else raw.replace("\ufeff", "")
    SYNTOK_AVAILABLE = args.engine == "syntok"
    original_blocks = parse_blocks(source)
    blocks, profile, structure_edits, structure_warnings, structure_errors = apply_structure_profile(original_blocks, args.structure_profile)
    output, layout_stats = format_book(blocks, args.preserve_below_chars, args.target_chars, args.max_chars, args.min_chars, args.secondary_break_threshold)

    warnings = list(structure_warnings)
    errors = list(structure_errors)
    if args.engine == "fallback":
        warnings.append("explicit fallback sentence splitter used; do not use this mode for final publication")
    if removed_zero_width:
        warnings.append(f"publication cleanup removed {removed_zero_width} internal U+FEFF characters")

    if profile == "none":
        content_ok = canonical(source) == canonical(remove_markdown_markup(output))
        integrity_mode = "exact canonical source equality after Markdown markers are removed"
    else:
        # Approved profile moves only known volume titles and adds known labels.
        content_ok = Counter(canonical(source)) == Counter(canonical(remove_markdown_markup(output)))
        integrity_mode = "approved structure profile character multiset equality"
    if not content_ok:
        errors.append("content integrity check failed: unexpected loss, duplication, or mutation detected")
    if errors and args.verify_integrity == "strict":
        print("error: strict validation failed; output was not written", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(output, encoding="utf-8")
    report = Metrics(
        input_file=str(args.input),
        output_file=str(args.output),
        output_format="markdown",
        sentence_engine=args.engine,
        input_chars=len(raw),
        output_chars=len(output),
        input_non_ws=len(canonical(source)),
        output_non_ws=len(canonical(remove_markdown_markup(output))),
        input_words=word_count(source),
        output_words=word_count(remove_markdown_markup(output)),
        input_blocks=len(original_blocks),
        output_blocks=len([item for item in output.split("\n\n") if item]),
        unchanged_short_blocks=layout_stats["unchanged_short_blocks"],
        quote_protected_blocks=layout_stats["quote_protected_blocks"],
        quote_breaks_prevented=layout_stats["quote_breaks_prevented"],
        secondary_sentence_breaks=layout_stats["secondary_sentence_breaks"],
        removed_zero_width=removed_zero_width,
        structure_profile=profile,
        structure_edits=structure_edits,
        content_integrity_mode=integrity_mode,
        warnings=warnings,
        errors=errors,
    )
    data = asdict(report)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(data, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
