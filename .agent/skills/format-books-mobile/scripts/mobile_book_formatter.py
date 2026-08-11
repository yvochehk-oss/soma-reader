#!/usr/bin/env python3
"""Agent-first, source-faithful mobile formatter for English/Swahili books.

Runtime dependency policy: Python standard library only.

The script is deliberately not the editor. It creates exact source slices and
review packets, validates the Agent's paragraph decisions, renders those
choices, and proves source-payload integrity. Formal rendering never invents
semantic paragraph boundaries or emergency long-sentence splits.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import statistics
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

VERSION = 3
WS_RE = re.compile(r"\s+")
SCENE_RE = re.compile(r"^\s*(?:(?:\*\s*){3,}|(?:[-_=]\s*){3,})$")
MARKDOWN_HEADING_RE = re.compile(r"^\s*#{1,6}\s+\S")
LIST_LINE_RE = re.compile(r"^\s*(?:[-*+]\s+|\d+[.)]\s+)")
BLOCKQUOTE_LINE_RE = re.compile(r"^\s*>\s?")
FOOTNOTE_RE = re.compile(r"^\s*\[\^[^\]]+\]:")
HTML_BLOCK_RE = re.compile(r"^\s*</?[A-Za-z][^>]*>")
LETTER_RE = re.compile(r"^\s*(?:dear\s+|my\s+dear\s+)", re.IGNORECASE)
FRONT_TITLE_RE = re.compile(r"^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’\-]*(?:\s+[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’\-]*){0,11}$")
QUOTE_CHARS = '"“”„«»'
CLOSERS = '"”’»)]}'

EN_NUMBERS = (
    "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|"
    "fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|"
    "first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth"
)
SW_NUMBERS = (
    "kwanza|pili|tatu|nne|tano|sita|saba|nane|tisa|kumi|kumi na moja|kumi na mbili|"
    "ishirini|thelathini|arobaini|hamsini"
)
HEADING_RE = re.compile(
    rf"^\s*(?:"
    rf"(?:book|part|volume|kitabu|sehemu|juzuu)\s+(?:the\s+|ya\s+)?(?:[ivxlcdm]+|\d+|{EN_NUMBERS}|{SW_NUMBERS})\b|"
    rf"(?:chapter)\s+(?:the\s+)?(?:[ivxlcdm]+|\d+|{EN_NUMBERS})\b|"
    rf"(?:sura)\s+(?:ya\s+)?(?:[ivxlcdm]+|\d+|{SW_NUMBERS})\b|"
    r"prologue\b|epilogue\b|preface\b|introduction\b|contents\s*$|"
    r"utangulizi\b|hitimisho\b|yaliyomo\s*$)" ,
    re.IGNORECASE,
)

IMPORTANCE_VALUES = {
    "normal",
    "pivotal_dialogue",
    "pivotal_description",
    "pivotal_interiority",
    "scene_turn",
}
MANDATORY_STANDALONE = {
    "pivotal_dialogue",
    "pivotal_description",
    "pivotal_interiority",
}
DECISION_KEYS = {
    "unit_id",
    "importance",
    "standalone",
    "break_before",
    "break_after",
    "split_after_offsets",
    "reason",
}

# A deliberately compact, auditable set. These rules are inspired by the
# pragmatic/golden-rule style of sentence-boundary disambiguation, but the
# formatter does not vendor or import any third-party implementation.
COMMON_ABBREVIATIONS = {
    "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "mt", "rev", "hon", "gen", "col", "maj",
    "capt", "lt", "sgt", "sen", "rep", "gov", "pres", "no", "nos", "fig", "eq", "dept", "est", "approx",
    "etc", "e.g", "i.e", "vs", "cf", "al", "vol", "pp", "p", "ed", "eds", "trans", "a.m", "p.m",
    # Common Swahili/editorial forms and borrowed titles encountered in East African texts.
    "bw", "bi", "dk", "prof", "mhe", "k.m", "n.k", "n.k.k",
}
ATTRIBUTION_WORDS = {
    "he", "she", "they", "i", "we", "you", "it",
    "said", "asked", "replied", "answered", "whispered", "shouted", "cried", "murmured", "added",
    "alisema", "akauliza", "alijibu", "akanong'ona", "akanong’ona", "alipaza", "aliongeza", "akasema",
}


class FormatterError(RuntimeError):
    pass


@dataclass
class Fragment:
    text: str
    unit_id: str
    decision: dict[str, Any]


def canonical(text: str) -> str:
    """Whitespace-insensitive payload form; every non-whitespace character matters."""
    return WS_RE.sub("", text)


def inline(text: str) -> str:
    return WS_RE.sub(" ", text).strip()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_text(text: str) -> str:
    return sha256_bytes(text.encode("utf-8"))


def json_dump(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2) + "\n"


def atomic_write(path: Path, data: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(handle, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    except Exception:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise


def resolved(path: Path) -> Path:
    return path.expanduser().resolve()


def require_distinct(named_paths: dict[str, Path]) -> None:
    seen: dict[Path, str] = {}
    for label, path in named_paths.items():
        value = resolved(path)
        if value in seen:
            raise FormatterError(f"{label} path must differ from {seen[value]} path: {value}")
        seen[value] = label


def word_count(text: str) -> int:
    return len(re.findall(r"\b[\w’'-]+\b", text, re.UNICODE))


def visible_length(text: str) -> int:
    return len(inline(text))


def _trim_span(text: str, start: int, end: int) -> tuple[int, int]:
    while start < end and text[start].isspace():
        start += 1
    while end > start and text[end - 1].isspace():
        end -= 1
    return start, end


def _line_records(text: str) -> list[tuple[int, int, str]]:
    records: list[tuple[int, int, str]] = []
    cursor = 0
    for line in text.splitlines(keepends=True):
        end = cursor + len(line)
        records.append((cursor, end, line))
        cursor = end
    if cursor < len(text):
        records.append((cursor, len(text), text[cursor:]))
    return records


def protected_markdown_ranges(text: str) -> list[tuple[int, int, str]]:
    """Return source ranges that must pass through untouched as structural blocks."""
    lines = _line_records(text)
    ranges: list[tuple[int, int, str]] = []
    i = 0

    # YAML front matter is special only at the start of a Markdown document.
    if lines and lines[0][2].strip() == "---":
        for j in range(1, len(lines)):
            if lines[j][2].strip() in {"---", "..."}:
                ranges.append((0, lines[j][1], "yaml_front_matter"))
                i = j + 1
                break

    while i < len(lines):
        start, _, line = lines[i]
        match = re.match(r"^[ \t]{0,3}(`{3,}|~{3,})", line.rstrip("\r\n"))
        if not match:
            i += 1
            continue
        fence = match.group(1)
        fence_char = fence[0]
        fence_len = len(fence)
        end = lines[i][1]
        j = i + 1
        while j < len(lines):
            _, candidate_end, candidate_line = lines[j]
            close = re.match(rf"^[ \t]{{0,3}}{re.escape(fence_char)}{{{fence_len},}}[ \t]*$", candidate_line.rstrip("\r\n"))
            end = candidate_end
            if close:
                break
            j += 1
        ranges.append((start, end, "fenced_code"))
        i = j + 1

    # Merge/normalize; front matter and fences should not overlap, but defensive handling is cheap.
    ranges.sort()
    merged: list[tuple[int, int, str]] = []
    for start, end, kind in ranges:
        if merged and start < merged[-1][1]:
            prev_start, prev_end, prev_kind = merged[-1]
            merged[-1] = (prev_start, max(prev_end, end), prev_kind)
        else:
            merged.append((start, end, kind))
    return merged


def _looks_like_markdown_table(lines: list[str]) -> bool:
    if len(lines) < 2:
        return False
    if not all("|" in line for line in lines[:2]):
        return False
    separator = lines[1].strip().strip("|")
    cells = [cell.strip() for cell in separator.split("|")]
    return bool(cells) and all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells)


def classify_block(text: str, index: int, forced_kind: str | None = None) -> str:
    if forced_kind:
        return forced_kind
    stripped = text.strip()
    lines = [line for line in stripped.splitlines() if line.strip()]
    if len(lines) == 1 and MARKDOWN_HEADING_RE.match(stripped):
        return "markdown_heading"
    if SCENE_RE.fullmatch(stripped):
        return "scene_break"
    if lines and all(BLOCKQUOTE_LINE_RE.match(line) for line in lines):
        return "blockquote"
    if lines and _looks_like_markdown_table(lines):
        return "table"
    if lines and FOOTNOTE_RE.match(lines[0]):
        return "footnote"
    if lines and HTML_BLOCK_RE.match(lines[0]):
        return "html_block"
    if lines and (LETTER_RE.match(lines[0]) or re.match(r"^\s*yours\s+(?:truly|sincerely)\b", lines[-1], re.I)):
        return "letter"
    if lines and all(LIST_LINE_RE.match(line) for line in lines):
        if len(lines) >= 2 or visible_length(stripped) <= 360:
            return "list"
    # Author/editor/translator bylines are metadata, not section headings.
    if len(lines) == 1 and re.match(r"^\s*(?:by|edited\s+by|translated\s+by)\b", stripped, re.I):
        return "prose"
    if len(lines) == 1 and re.fullmatch(r"(?i:contents|illustrations)\.?", stripped):
        return "heading"
    # Classical chapter form used by many Gutenberg texts: ``I. THE PRISON DOOR``.
    # Gutenberg sometimes hard-wraps the numeral and title onto two lines.
    if len(stripped) <= 200:
        one_line = inline(stripped)
        if re.match(r"^\s*[IVXLCDM]+[.)]\s+\S", one_line, re.I):
            return "heading"
    if len(stripped) <= 200 and HEADING_RE.match(stripped):
        return "heading"
    if index < 10 and len(stripped) <= 100 and not re.search(r"[.!?;:]", stripped):
        words = re.findall(r"[A-Za-zÀ-ÖØ-öø-ÿ]+(?:['’][A-Za-zÀ-ÖØ-öø-ÿ]+)?", stripped)
        if stripped.isupper() or (FRONT_TITLE_RE.fullmatch(stripped) and words and all(w[:1].isupper() for w in words)):
            return "heading"
    if len(lines) >= 3:
        short_ratio = sum(word_count(line) <= 9 for line in lines) / len(lines)
        punctuated_ratio = sum(bool(re.search(r"[.!?;,:—-]\s*$", line)) for line in lines) / len(lines)
        if short_ratio >= 0.85 and punctuated_ratio >= 0.35:
            return "poetry"
    return "prose"


def _append_block(blocks: list[dict[str, Any]], text: str, start: int, end: int, forced_kind: str | None = None) -> None:
    start, end = _trim_span(text, start, end)
    if start >= end:
        return
    value = text[start:end]
    blocks.append(
        {
            "id": f"b{len(blocks) + 1:05d}",
            "source_index": len(blocks),
            "kind": classify_block(value, len(blocks), forced_kind),
            "text": value,
            "source_start": start,
            "source_end": end,
            "unit_ids": [],
        }
    )


def _split_region_on_blank_lines(text: str, start: int, end: int, blocks: list[dict[str, Any]]) -> None:
    if start >= end:
        return
    region = text[start:end]
    # Treat CRLF as one logical line break. The old alternation could
    # backtrack and reinterpret a single ``\r\n`` as ``\r`` + ``\n``,
    # falsely turning every Windows line ending into a blank-line separator.
    linebreak = r"(?:\r\n|(?<!\r)\n|\r(?!\n))"
    separator = re.compile(rf"{linebreak}[ \t]*(?:{linebreak}[ \t]*)+")
    cursor = 0
    for match in separator.finditer(region):
        _append_block(blocks, text, start + cursor, start + match.start())
        cursor = match.end()
    _append_block(blocks, text, start + cursor, end)


def _toc_entry_key(text: str) -> str:
    value = inline(text).strip()
    match = re.match(r"^(CHAPTER\s+(?:THE\s+)?(?:[IVXLCDM]+|\d+|[A-Z]+))\b", value, re.I)
    if match:
        return match.group(1).upper().replace("  ", " ")
    # Gutenberg editions often append source-footnote markers to story titles
    # (e.g. ``THE DRAGON OF THE NORTH(2)``) that are absent from the TOC.
    value = re.sub(r"\s*\(\d+\)\s*$", "", value)
    value = value.casefold().replace("’", "'")
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def _looks_like_toc_line(line: str) -> bool:
    value = inline(line).strip()
    if not value or len(value) > 220:
        return False
    if re.match(r"^(?:CHAPTER|BOOK|PART|VOLUME)\b", value, re.I):
        return True
    if re.match(r"^[IVXLCDM]+[.)]\s+\S", value, re.I):
        return True
    words = re.findall(r"[A-Za-zÀ-ÖØ-öø-ÿ]+(?:['’][A-Za-zÀ-ÖØ-öø-ÿ]+)?", value)
    return bool(words) and (value.isupper() or sum(w[:1].isupper() for w in words) >= max(1, len(words) - 1))


def annotate_toc_and_repeated_headings(blocks: list[dict[str, Any]]) -> None:
    """Preserve TOC entries as lines and promote matching repeated body titles.

    This is structural detection only. It never changes source text or chooses
    prose paragraph boundaries.
    """
    contents_index = next(
        (i for i, b in enumerate(blocks) if re.fullmatch(r"(?i:contents)\.?", inline(b["text"]).strip())),
        None,
    )
    if contents_index is None:
        return

    toc_indices: list[int] = []
    i = contents_index + 1
    # Common Gutenberg form: one multi-line block containing all TOC entries.
    if i < len(blocks):
        lines = [line.strip() for line in blocks[i]["text"].splitlines() if line.strip()]
        if len(lines) >= 3 and (
            sum(_looks_like_toc_line(line) for line in lines) / len(lines) >= 0.7
            or (len(lines) >= 8 and max(map(len, lines)) <= 220)
        ):
            toc_indices.append(i)
            i += 1
        else:
            # Alternate form: one block per chapter entry. Consume only the
            # consecutive run of entry-like blocks, stopping before preface/body.
            while i < len(blocks):
                lines = [line.strip() for line in blocks[i]["text"].splitlines() if line.strip()]
                if not lines or not _looks_like_toc_line(lines[0]):
                    break
                if not re.match(r"^(?:CHAPTER|BOOK|PART|VOLUME)\b", inline(lines[0]), re.I):
                    break
                toc_indices.append(i)
                i += 1

    toc_entries: set[str] = set()
    for idx in toc_indices:
        blocks[idx]["kind"] = "toc"
        for line in blocks[idx]["text"].splitlines():
            if line.strip():
                toc_entries.add(_toc_entry_key(line))

    # Promote exact repeated TOC titles in the body (fairy-tale titles,
    # Roman-numbered chapter titles, etc.), but never author/editor bylines.
    if toc_entries:
        after = (max(toc_indices) + 1) if toc_indices else contents_index + 1
        title_key = next((_toc_entry_key(b["text"]) for b in blocks[:contents_index] if b.get("kind") == "heading"), "")
        for block in blocks[after:]:
            lines = [line.strip() for line in block["text"].splitlines() if line.strip()]
            if not lines or len(lines) > 3:
                continue
            value = inline(block["text"])
            if re.match(r"^(?:by|edited\s+by|translated\s+by)\b", value, re.I):
                continue
            key = _toc_entry_key(value)
            if key in toc_entries or (title_key and key == title_key):
                block["kind"] = "heading"


def annotate_illustrations(blocks: list[dict[str, Any]]) -> None:
    idx = next(
        (i for i, b in enumerate(blocks) if re.fullmatch(r"(?i:illustrations)\.?", inline(b["text"]).strip())),
        None,
    )
    if idx is None or idx + 1 >= len(blocks):
        return
    blocks[idx]["kind"] = "heading"
    i = idx + 1
    first = blocks[i]
    lines = [line.strip() for line in first["text"].splitlines() if line.strip()]
    # One packed multi-line illustration list (Huckleberry Finn).
    if len(lines) >= 5 and max(map(len, lines)) <= 100:
        first["kind"] = "toc"
        return
    # One caption per blank-line block (Tom Sawyer).
    while i < len(blocks):
        value = inline(blocks[i]["text"]).strip()
        if not value or visible_length(value) > 80:
            break
        if re.match(r"^(?:preface|chapter|notice|explanatory|contents)\b", value, re.I):
            break
        blocks[i]["kind"] = "toc"
        i += 1


def split_blocks(text: str, source_format: str) -> list[dict[str, Any]]:
    """Split prose blocks but preserve fenced code/front matter as opaque exact slices."""
    if source_format != "markdown":
        blocks: list[dict[str, Any]] = []
        _split_region_on_blank_lines(text, 0, len(text), blocks)
    else:
        blocks = []
        cursor = 0
        for start, end, kind in protected_markdown_ranges(text):
            _split_region_on_blank_lines(text, cursor, start, blocks)
            _append_block(blocks, text, start, end, forced_kind=kind)
            cursor = end
        _split_region_on_blank_lines(text, cursor, len(text), blocks)
    annotate_toc_and_repeated_headings(blocks)
    annotate_illustrations(blocks)
    if canonical(text) != canonical("\n\n".join(block["text"] for block in blocks)):
        raise FormatterError("internal block parser changed non-whitespace source characters")
    return blocks


def _next_nonspace(text: str, index: int) -> tuple[int, str]:
    while index < len(text) and text[index].isspace():
        index += 1
    return index, text[index:index + 1]


def _next_word(text: str, index: int) -> str:
    match = re.match(r"\s*([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’\-]*)", text[index:])
    return match.group(1) if match else ""


def _token_before_dot(text: str, dot_index: int) -> str:
    start = dot_index
    while start > 0 and (text[start - 1].isalpha() or text[start - 1] in "."):
        start -= 1
    return text[start:dot_index].strip(".").lower()


def _looks_internal_url_or_email(text: str, dot_index: int) -> bool:
    left = dot_index
    right = dot_index + 1
    while left > 0 and not text[left - 1].isspace():
        left -= 1
    while right < len(text) and not text[right].isspace():
        right += 1
    token = text[left:right].strip('"“”\'()[]{}<>,;:!?')
    local = dot_index - left
    if not (0 <= local < len(token)):
        return False
    if "@" in token or "://" in token or token.lower().startswith("www."):
        return local < len(token) - 1
    # Domain-like token: protect internal dots, not a terminal full stop after it.
    return bool(re.fullmatch(r"[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+", token)) and dot_index < right - 1


def builtin_boundaries(text: str, lang: str) -> list[int]:
    """Dependency-free sentence-boundary candidates for addressable source units.

    This is deliberately conservative and transparent. Agent decisions, not
    these candidates, control paragraph layout.
    """
    boundaries: list[int] = []
    i = 0
    while i < len(text):
        char = text[i]
        if char not in ".!?":
            i += 1
            continue

        # Numeric decimals/version-like forms: 3.14, 1.2.3.
        if char == "." and i > 0 and i + 1 < len(text) and text[i - 1].isdigit() and text[i + 1].isdigit():
            i += 1
            continue
        if char == "." and _looks_internal_url_or_email(text, i):
            i += 1
            continue

        end = i + 1
        while end < len(text) and text[end] in ".!?":
            end += 1
        punctuation = text[i:end]
        while end < len(text) and text[end] in CLOSERS:
            end += 1

        next_index, next_char = _next_nonspace(text, end)
        next_word = _next_word(text, end)
        lower_next = next_word.lower()

        # Dialogue attribution: “Why?” he asked. / “Kwa nini?” akauliza.
        if any(q in text[i + 1:end] for q in CLOSERS) and lower_next in ATTRIBUTION_WORDS:
            i = end
            continue

        if char == "." and punctuation == ".":
            token = _token_before_dot(text, i)
            if token in COMMON_ABBREVIATIONS:
                # a.m./p.m. often terminate a sentence; other common abbreviations usually do not.
                if token not in {"a.m", "p.m"}:
                    i = end
                    continue
                if next_word and next_word[:1].islower():
                    i = end
                    continue
            # Initials and multi-dot abbreviations. Over-splitting here is safer
            # than under-splitting because the Agent can explicitly keep units together.
            prefix = text[max(0, i - 20):i + 1]
            if len(token) == 1 and re.search(r"(?:\b[A-Za-z]\.)$", prefix):
                if next_word and (len(next_word) == 1 or next_word[:1].isupper()):
                    i = end
                    continue
            if re.search(r"(?:\b[A-Za-z]{1,4}\.){2,}$", prefix):
                if next_word and next_word[:1].islower():
                    i = end
                    continue

        # A punctuation mark is only considered a candidate sentence boundary
        # when followed by whitespace/end. This keeps file names and compact
        # punctuation sequences from fragmenting needlessly.
        if next_index >= len(text) or (end < len(text) and text[end:next_index]) or end == len(text):
            boundaries.append(end)
        i = end
    return boundaries


def sentence_spans(text: str, lang: str) -> list[tuple[int, int]]:
    boundaries = sorted({point for point in builtin_boundaries(text, lang) if 0 < point <= len(text)})
    if not boundaries or boundaries[-1] != len(text):
        boundaries.append(len(text))
    spans: list[tuple[int, int]] = []
    start = 0
    for end in boundaries:
        if end <= start:
            continue
        if text[start:end].strip():
            spans.append((start, end))
        start = end
    if not spans and text:
        spans = [(0, len(text))]
    if canonical(text) != canonical("".join(text[a:b] for a, b in spans)):
        raise FormatterError("sentence segmentation changed non-whitespace source characters")
    return spans


def span_coverage(source: str, units: list[dict[str, Any]]) -> dict[str, Any]:
    intervals = sorted((int(u["source_start"]), int(u["source_end"]), u["id"]) for u in units)
    unit_by_id = {u["id"]: u for u in units}
    missing_non_ws = 0
    overlap_chars = 0
    exact_slice_failures: list[str] = []
    cursor = 0
    for start, end, unit_id in intervals:
        if start < cursor:
            overlap_chars += cursor - start
        if start > cursor:
            missing_non_ws += sum(not ch.isspace() for ch in source[cursor:start])
        if source[start:end] != unit_by_id[unit_id]["text"]:
            exact_slice_failures.append(unit_id)
        cursor = max(cursor, end)
    if cursor < len(source):
        missing_non_ws += sum(not ch.isspace() for ch in source[cursor:])
    return {
        "ok": missing_non_ws == 0 and overlap_chars == 0 and not exact_slice_failures,
        "missing_non_ws_chars": missing_non_ws,
        "duplicate_or_overlap_chars": overlap_chars,
        "exact_slice_failures": exact_slice_failures,
        "unit_spans": len(intervals),
    }


def quote_ratio(text: str) -> float:
    if not text:
        return 0.0
    quoted = False
    quoted_chars = 0
    straight_open = False
    for char in text:
        if char in "“„«":
            quoted = True
        elif char in "”»":
            quoted = False
        elif char == '"':
            straight_open = not straight_open
            quoted = straight_open
        elif quoted:
            quoted_chars += 1
    return round(quoted_chars / max(1, len(text)), 3)


def long_sentence_candidates(text: str, source_start: int) -> list[dict[str, Any]]:
    """Expose exact-slice split candidates; only the Agent may choose them formally."""
    if visible_length(text) <= 240:
        return []
    candidates: dict[int, dict[str, Any]] = {}
    for match in re.finditer(r"[;:—–,.!?]", text):
        offset = match.end()
        while offset < len(text) and text[offset] in CLOSERS:
            offset += 1
        if offset >= len(text):
            continue
        candidates[offset] = {
            "offset": offset,
            "source_offset": source_start + offset,
            "source": "punctuation",
            "punctuation": match.group(),
            "left_context": inline(text[max(0, offset - 80):offset]),
            "right_context": inline(text[offset:offset + 80]),
        }

    # If punctuation is sparse, expose sparse whitespace candidates so the Agent
    # can still make a semantic split in damaged/run-on prose without a package.
    if visible_length(text) > 360:
        last_added = -999
        for match in re.finditer(r"\s+", text):
            offset = match.start()
            if offset <= 0 or offset >= len(text):
                continue
            if offset - last_added < 90:
                continue
            left_len = visible_length(text[max(0, offset - 180):offset])
            right_len = visible_length(text[offset:offset + 180])
            if left_len >= 60 and right_len >= 40:
                candidates.setdefault(
                    offset,
                    {
                        "offset": offset,
                        "source_offset": source_start + offset,
                        "source": "whitespace_fallback",
                        "punctuation": "",
                        "left_context": inline(text[max(0, offset - 80):offset]),
                        "right_context": inline(text[offset:offset + 80]),
                    },
                )
                last_added = offset
    return [candidates[key] for key in sorted(candidates)]


def make_unit(
    unit_id: str,
    block: dict[str, Any],
    index: int,
    text: str,
    editable: bool,
    source_start: int,
    source_end: int,
) -> dict[str, Any]:
    normalized = inline(text)
    dialogue = any(char in normalized for char in QUOTE_CHARS)
    hint = "review_dialogue" if dialogue else "normal"
    if re.search(r"\b(?:suddenly|at once|the next morning|that night|meanwhile|without warning|ghafla|asubuhi iliyofuata)\b", normalized, re.I):
        hint = "review_scene_turn"
    return {
        "id": unit_id,
        "block_id": block["id"],
        "index_in_block": index,
        "block_kind": block["kind"],
        "editable": editable,
        "text": text,
        "display_text": normalized,
        "source_start": source_start,
        "source_end": source_end,
        "chars": len(normalized),
        "dialogue": dialogue,
        "quote_ratio": quote_ratio(normalized),
        "question": "?" in normalized,
        "exclamation": "!" in normalized,
        "heuristic_hint": hint,
        "split_candidates": long_sentence_candidates(text, source_start) if editable else [],
    }


def build_units(blocks: list[dict[str, Any]], lang: str) -> list[dict[str, Any]]:
    units: list[dict[str, Any]] = []
    for block in blocks:
        spans = sentence_spans(block["text"], lang) if block["kind"] == "prose" else [(0, len(block["text"]))]
        for index, (local_start, local_end) in enumerate(spans):
            part = block["text"][local_start:local_end]
            unit_id = f"u{len(units) + 1:07d}"
            absolute_start = block["source_start"] + local_start
            absolute_end = block["source_start"] + local_end
            unit = make_unit(
                unit_id,
                block,
                index,
                part,
                block["kind"] == "prose",
                absolute_start,
                absolute_end,
            )
            units.append(unit)
            block["unit_ids"].append(unit_id)
    if canonical("\n\n".join(block["text"] for block in blocks)) != canonical("".join(unit["text"] for unit in units)):
        raise FormatterError("unit construction changed non-whitespace source characters")
    return units


def packetize(units: list[dict[str, Any]], batch_chars: int) -> list[list[dict[str, Any]]]:
    packets: list[list[dict[str, Any]]] = []
    current: list[dict[str, Any]] = []
    count = 0
    for unit in units:
        length = max(1, unit["chars"])
        if current and count + length > batch_chars:
            packets.append(current)
            current = []
            count = 0
        current.append(unit)
        count += length
    if current:
        packets.append(current)
    return packets


def prepare(args: argparse.Namespace) -> int:
    source_path = resolved(args.input)
    workspace = resolved(args.workspace)
    if not source_path.is_file():
        raise FormatterError(f"input file not found: {source_path}")
    if workspace.exists() and any(workspace.iterdir()):
        raise FormatterError(f"workspace is not empty; use a new directory: {workspace}")
    workspace.mkdir(parents=True, exist_ok=True)
    packets_dir = workspace / "packets"
    decisions_dir = workspace / "decisions"
    packets_dir.mkdir(exist_ok=True)
    decisions_dir.mkdir(exist_ok=True)

    raw_bytes = source_path.read_bytes()
    # utf-8-sig removes only a leading BOM. Internal U+FEFF is source payload
    # and is deliberately preserved and reported, never silently deleted.
    source = raw_bytes.decode("utf-8-sig")
    source_format = args.source_format
    if source_format == "auto":
        source_format = "markdown" if source_path.suffix.lower() in {".md", ".markdown"} else "plain"

    blocks = split_blocks(source, source_format)
    units = build_units(blocks, args.lang)
    coverage = span_coverage(source, units)
    if not coverage["ok"]:
        raise FormatterError(f"span coverage failed during prepare: {coverage}")
    groups = packetize(units, args.batch_chars)
    position = {unit["id"]: index for index, unit in enumerate(units)}
    packet_meta: list[dict[str, Any]] = []

    for index, group in enumerate(groups):
        packet_id = f"p{index + 1:04d}"
        first_position = position[group[0]["id"]]
        last_position = position[group[-1]["id"]]
        before = units[max(0, first_position - 2):first_position]
        after = units[last_position + 1:min(len(units), last_position + 3)]
        editable_ids = [unit["id"] for unit in group if unit["editable"]]
        packet = {
            "schema_version": VERSION,
            "packet_id": packet_id,
            "agent_role": "primary_editor",
            "instructions": (
                "Read every unit and surrounding context. You, not the script, decide every prose paragraph boundary. "
                "Return exactly one decision for every editable unit, with explicit break_after=true/false. "
                "Use importance/standalone/break_before/split_after_offsets only when semantically justified. "
                "Never rewrite, correct, translate, summarize, or replace source text."
            ),
            "context_before": [unit["display_text"] for unit in before],
            "context_after": [unit["display_text"] for unit in after],
            "required_editable_unit_ids": editable_ids,
            "units": [
                {
                    key: unit[key]
                    for key in (
                        "id", "block_id", "block_kind", "editable", "display_text", "chars", "dialogue",
                        "quote_ratio", "question", "exclamation", "heuristic_hint", "split_candidates",
                        "source_start", "source_end",
                    )
                }
                for unit in group
            ],
        }
        filename = f"{packet_id}.json"
        atomic_write(packets_dir / filename, json_dump(packet))
        packet_meta.append(
            {
                "id": packet_id,
                "file": f"packets/{filename}",
                "unit_ids": [unit["id"] for unit in group],
                "editable_unit_ids": editable_ids,
                "chars": sum(unit["chars"] for unit in group),
            }
        )

    manifest = {
        "schema_version": VERSION,
        "architecture": "agent-first",
        "runtime_dependencies": [],
        "source_file": str(source_path),
        "source_sha256": sha256_bytes(raw_bytes),
        "source_canonical_sha256": sha256_text(canonical(source)),
        "source_chars": len(source),
        "source_non_ws": len(canonical(source)),
        "internal_u_feff_count": source.count("\ufeff"),
        "sentence_engine": "builtin-candidate-segmenter",
        "language": args.lang,
        "span_coverage": coverage,
        "source_format": source_format,
        "batch_chars": args.batch_chars,
        "blocks": blocks,
        "units": units,
        "packets": packet_meta,
    }
    atomic_write(workspace / "manifest.json", json_dump(manifest))
    summary = {
        "workspace": str(workspace),
        "manifest": str(workspace / "manifest.json"),
        "architecture": "agent-first",
        "runtime_dependencies": [],
        "packets": len(packet_meta),
        "blocks": len(blocks),
        "units": len(units),
        "editable_units": sum(unit["editable"] for unit in units),
        "source_format": source_format,
        "span_coverage": coverage,
        "next_step": "Agent reviews every packet and writes one complete decision file per packet into decisions/.",
    }
    print(json_dump(summary), end="")
    return 0


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise FormatterError(f"cannot read valid JSON from {path}: {exc}") from exc


def load_decisions(manifest: dict[str, Any], decisions_dir: Path) -> tuple[dict[str, dict[str, Any]], set[str], list[str]]:
    packet_map = {packet["id"]: packet for packet in manifest["packets"]}
    unit_map = {unit["id"]: unit for unit in manifest["units"] if unit["editable"]}
    decisions: dict[str, dict[str, Any]] = {}
    reviewed: set[str] = set()
    missing_coverage: list[str] = []

    for path in sorted(decisions_dir.glob("*.json")):
        data = load_json(path)
        packet_id = data.get("packet_id")
        if packet_id not in packet_map:
            raise FormatterError(f"unknown packet_id in {path}: {packet_id!r}")
        if data.get("schema_version") != VERSION:
            raise FormatterError(f"decision file must use schema_version={VERSION}: {path}")
        if data.get("reviewed") is not True:
            raise FormatterError(f"decision file must set reviewed=true: {path}")
        if packet_id in reviewed:
            raise FormatterError(f"duplicate decision file for packet {packet_id}")
        reviewed.add(packet_id)

        packet_allowed = set(packet_map[packet_id].get("editable_unit_ids", []))
        seen_in_packet: set[str] = set()
        for decision in data.get("decisions", []):
            unknown = set(decision) - DECISION_KEYS
            if unknown:
                raise FormatterError(f"unknown decision keys for {decision.get('unit_id')}: {sorted(unknown)}")
            unit_id = decision.get("unit_id")
            if unit_id not in unit_map or unit_id not in packet_allowed:
                raise FormatterError(f"decision references unknown/non-prose/wrong-packet unit: {unit_id!r}")
            if unit_id in seen_in_packet or unit_id in decisions:
                raise FormatterError(f"duplicate decision for unit {unit_id}")
            seen_in_packet.add(unit_id)
            if "break_after" not in decision or not isinstance(decision["break_after"], bool):
                raise FormatterError(f"Agent must explicitly set break_after=true/false for {unit_id}")
            importance = decision.get("importance", "normal")
            if importance not in IMPORTANCE_VALUES:
                raise FormatterError(f"invalid importance for {unit_id}: {importance!r}")
            for key in ("standalone", "break_before"):
                if key in decision and not isinstance(decision[key], bool):
                    raise FormatterError(f"{key} must be boolean for {unit_id}")
            if importance in MANDATORY_STANDALONE and decision.get("standalone") is False:
                raise FormatterError(f"pivotal unit {unit_id} cannot set standalone=false")
            if "split_after_offsets" in decision:
                offsets = decision["split_after_offsets"]
                if not isinstance(offsets, list) or not all(isinstance(value, int) for value in offsets):
                    raise FormatterError(f"split_after_offsets must be an integer list for {unit_id}")
                allowed_offsets = {item["offset"] for item in unit_map[unit_id].get("split_candidates", [])}
                if not set(offsets) <= allowed_offsets:
                    raise FormatterError(f"split_after_offsets contains a non-candidate offset for {unit_id}")
                if offsets != sorted(set(offsets)):
                    raise FormatterError(f"split_after_offsets must be sorted and unique for {unit_id}")
            decisions[unit_id] = decision

        missing = sorted(packet_allowed - seen_in_packet)
        if missing:
            missing_coverage.extend(missing)

    return decisions, reviewed, missing_coverage


def split_by_agent_offsets(text: str, offsets: list[int] | None) -> list[str]:
    points = offsets or []
    if not points:
        return [inline(text)] if text.strip() else []
    boundaries = [0, *points, len(text)]
    pieces = [inline(text[a:b]) for a, b in zip(boundaries, boundaries[1:]) if text[a:b].strip()]
    if canonical(text) != canonical(" ".join(pieces)):
        raise FormatterError("Agent-selected split changed non-whitespace characters")
    return pieces


def agent_paragraphize(
    units: list[dict[str, Any]],
    decisions: dict[str, dict[str, Any]],
    hard_max: int,
    allow_unreviewed: bool,
) -> tuple[list[list[Fragment]], list[dict[str, Any]]]:
    """Render only Agent boundary decisions; there is no semantic auto-planner."""
    output: list[list[Fragment]] = []
    current: list[Fragment] = []
    selected_splits: list[dict[str, Any]] = []

    def flush() -> None:
        nonlocal current
        if current:
            output.append(current)
            current = []

    for unit in units:
        decision = decisions.get(unit["id"])
        if decision is None:
            if not allow_unreviewed:
                raise FormatterError(f"missing Agent decision for {unit['id']}")
            decision = {"unit_id": unit["id"], "importance": "normal", "break_after": False, "reason": "preview passthrough"}

        importance = decision.get("importance", "normal")
        standalone = importance in MANDATORY_STANDALONE or decision.get("standalone", False)
        if decision.get("break_before") or standalone:
            flush()

        pieces = split_by_agent_offsets(unit["text"], decision.get("split_after_offsets"))
        if decision.get("split_after_offsets"):
            selected_splits.append(
                {
                    "unit_id": unit["id"],
                    "offsets": decision["split_after_offsets"],
                    "pieces": pieces,
                }
            )
        for piece_index, piece in enumerate(pieces):
            if visible_length(piece) > hard_max:
                raise FormatterError(
                    f"Agent must choose additional split candidates for {unit['id']}; "
                    f"piece is {visible_length(piece)} chars > hard max {hard_max}"
                )
            current.append(Fragment(piece, unit["id"], decision))
            # Every selected internal sentence/clause split is an explicit paragraph boundary.
            if piece_index < len(pieces) - 1:
                flush()

        if standalone or decision["break_after"]:
            flush()

    flush()  # source block boundaries are always paragraph boundaries

    for group in output:
        rendered = " ".join(fragment.text for fragment in group).strip()
        if visible_length(rendered) > hard_max:
            ids = ", ".join(fragment.unit_id for fragment in group)
            raise FormatterError(
                f"Agent paragraph exceeds hard max ({visible_length(rendered)} > {hard_max}); "
                f"revise break_after decisions for units: {ids}"
            )
    return output, selected_splits


def heading_prefix(text: str, *, first_heading: bool = False) -> str:
    # The publication title is the only H1. All detected structural sections
    # are H2 unless a future Agent decision explicitly introduces substructure.
    return "#" if first_heading else "##"


def band(length: int) -> str:
    if length < 140:
        return "short"
    if length < 300:
        return "medium"
    return "long"


def longest_same_band_run(lengths: list[int]) -> int:
    longest = current = 0
    previous: str | None = None
    for length in lengths:
        value = band(length)
        current = current + 1 if value == previous else 1
        previous = value
        longest = max(longest, current)
    return longest


def longest_short_run(lengths: list[int], threshold: int = 80) -> int:
    longest = current = 0
    for length in lengths:
        current = current + 1 if length < threshold else 0
        longest = max(longest, current)
    return longest


def repair_markdown_emphasis(paragraphs: list[str]) -> tuple[list[str], int, bool]:
    """Close/reopen source ** spans split by Agent-inserted paragraph boundaries."""
    rendered: list[str] = []
    bold_open = False
    synthetic_markers = 0
    for paragraph in paragraphs:
        value = paragraph
        if bold_open:
            value = "**" + value
            synthetic_markers += 1
        marker_count = len(re.findall(r"(?<!\\)\*\*", paragraph))
        if marker_count % 2:
            bold_open = not bold_open
        if bold_open:
            value += "**"
            synthetic_markers += 1
        rendered.append(value)
    return rendered, synthetic_markers, bold_open


def markdown_structure_checks(output: str) -> dict[str, Any]:
    lines = output.splitlines()
    malformed_headings = [i + 1 for i, line in enumerate(lines) if re.match(r"^#{1,6}[^ #]", line)]
    heading_levels = [len(match.group(1)) for line in lines if (match := re.match(r"^(#{1,6})\s+\S", line))]
    heading_jumps = [
        {"from": heading_levels[i - 1], "to": heading_levels[i], "index": i}
        for i in range(1, len(heading_levels))
        if heading_levels[i] > heading_levels[i - 1] + 1
    ]
    fence_stack: list[tuple[str, int]] = []
    for index, line in enumerate(lines, start=1):
        match = re.match(r"^[ \t]{0,3}(`{3,}|~{3,})", line)
        if not match:
            continue
        fence = match.group(1)
        char = fence[0]
        length = len(fence)
        if fence_stack and fence_stack[-1][0][0] == char and length >= len(fence_stack[-1][0]):
            fence_stack.pop()
        elif not fence_stack:
            fence_stack.append((fence, index))
    return {
        "ok": not malformed_headings and not fence_stack,
        "malformed_heading_lines": malformed_headings,
        "heading_level_jumps": heading_jumps,
        "unbalanced_fenced_code": [line for _, line in fence_stack],
        "heading_count": len(heading_levels),
    }


def render(args: argparse.Namespace) -> int:
    manifest_path = resolved(args.manifest)
    manifest = load_json(manifest_path)
    if manifest.get("schema_version") != VERSION:
        raise FormatterError(f"manifest must use schema_version={VERSION}")
    source_path = Path(manifest["source_file"])
    output_path = resolved(args.output)
    report_path = resolved(args.report)
    require_distinct({"input": source_path, "output": output_path, "report": report_path})
    if output_path.suffix.lower() != ".md":
        raise FormatterError("mobile publication output must use the .md extension")

    raw_bytes = source_path.read_bytes()
    if sha256_bytes(raw_bytes) != manifest["source_sha256"]:
        raise FormatterError("source file changed after prepare; create a new workspace")
    source = raw_bytes.decode("utf-8-sig")
    if sha256_text(canonical(source)) != manifest["source_canonical_sha256"]:
        raise FormatterError("source canonical checksum no longer matches manifest")

    decisions_dir = resolved(args.decisions_dir or manifest_path.parent / "decisions")
    decisions, reviewed, missing_decision_coverage = load_decisions(manifest, decisions_dir)
    packet_ids = {packet["id"] for packet in manifest["packets"]}
    unreviewed = sorted(packet_ids - reviewed)
    if (unreviewed or missing_decision_coverage) and not args.allow_unreviewed:
        details = []
        if unreviewed:
            details.append(f"{len(unreviewed)} unreviewed packets")
        if missing_decision_coverage:
            details.append(f"{len(missing_decision_coverage)} editable units without explicit Agent decisions")
        raise FormatterError("; ".join(details))

    soft_max = args.soft_max_chars
    hard_max = args.hard_max_chars
    if not (1 <= soft_max <= hard_max):
        raise FormatterError("require 1 <= soft max chars <= hard max chars")

    unit_map = {unit["id"]: unit for unit in manifest["units"]}
    coverage = span_coverage(source, manifest["units"])
    if not coverage["ok"]:
        raise FormatterError(f"span coverage failed before render: {coverage}")

    output_parts: list[str] = []
    payload_parts: list[str] = []
    prose_lengths: list[int] = []
    nonprose_overlong: list[dict[str, Any]] = []
    selected_splits: list[dict[str, Any]] = []
    pivotal_units = {
        unit_id for unit_id, decision in decisions.items()
        if decision.get("importance", "normal") in MANDATORY_STANDALONE
    }
    pivotal_standalone_violations: list[str] = []
    synthetic_markdown_markers = 0
    unbalanced_markdown_blocks: list[str] = []
    first_heading_emitted = False

    for block in manifest["blocks"]:
        units = [unit_map[unit_id] for unit_id in block["unit_ids"]]
        kind = block["kind"]
        if kind == "prose":
            groups, local_splits = agent_paragraphize(units, decisions, hard_max, args.allow_unreviewed)
            selected_splits.extend(local_splits)
            raw_values = [" ".join(fragment.text for fragment in group).strip() for group in groups]
            display_values = raw_values
            if manifest.get("source_format", "plain") == "markdown":
                display_values, local_markers, remains_open = repair_markdown_emphasis(raw_values)
                synthetic_markdown_markers += local_markers
                if remains_open:
                    unbalanced_markdown_blocks.append(block["id"])
            for group, value, display_value in zip(groups, raw_values, display_values):
                output_parts.append(display_value)
                payload_parts.append(value)
                prose_lengths.append(visible_length(value))
                pivotal_in_group = {fragment.unit_id for fragment in group if fragment.unit_id in pivotal_units}
                if pivotal_in_group and (len(group) != 1 or len(pivotal_in_group) != 1):
                    pivotal_standalone_violations.extend(sorted(pivotal_in_group))
        else:
            text = block["text"].strip()
            payload_parts.append(text)
            if kind == "heading":
                output_parts.append(f"{heading_prefix(text, first_heading=not first_heading_emitted)} {inline(text)}")
                first_heading_emitted = True
            elif kind in {"markdown_heading", "fenced_code", "yaml_front_matter", "blockquote", "table", "footnote", "html_block", "list", "scene_break"}:
                output_parts.append(text)
            elif kind in {"poetry", "letter", "toc"}:
                output_parts.append("  \n".join(line.rstrip() for line in text.splitlines()))
            else:
                output_parts.append(text)

            if kind not in {"heading", "markdown_heading", "scene_break", "fenced_code", "yaml_front_matter"}:
                visible_segments = [line.strip() for line in text.splitlines() if line.strip()] or [text]
                longest = max((visible_length(value) for value in visible_segments), default=0)
                if longest > hard_max:
                    nonprose_overlong.append({"block_id": block["id"], "kind": kind, "chars": longest})

    output = "\n\n".join(output_parts) + ("\n" if output_parts else "")
    emitted_payload = "\n\n".join(payload_parts)
    markdown_checks = markdown_structure_checks(output)
    integrity_ok = canonical(source) == canonical(emitted_payload)
    if not integrity_ok:
        raise FormatterError("payload integrity failed; output was not written")

    prose_over_hard = [length for length in prose_lengths if length > hard_max]
    if prose_over_hard:
        raise FormatterError(f"{len(prose_over_hard)} prose paragraphs exceed hard max; revise Agent decisions")

    lengths_sorted = sorted(prose_lengths)
    rhythm_run = longest_same_band_run(prose_lengths)
    short_run = longest_short_run(prose_lengths)
    soft_overages = [length for length in prose_lengths if length > soft_max]
    warnings: list[str] = []
    if unreviewed or missing_decision_coverage:
        warnings.append("preview only: Agent review/decision coverage is incomplete")
    if nonprose_overlong:
        warnings.append("some protected non-prose structures exceed the hard visual limit; inspect manually")
    if rhythm_run > 8:
        warnings.append(f"{rhythm_run} consecutive paragraphs share the same length band; Agent should inspect rhythm")
    if short_run > 7:
        warnings.append(f"{short_run} consecutive paragraphs are under 80 characters; inspect for choppy over-segmentation")
    if len(soft_overages) > max(3, len(prose_lengths) // 5):
        warnings.append("many prose paragraphs exceed the soft mobile target; inspect whether more semantic breaks are desirable")
    if unbalanced_markdown_blocks:
        warnings.append("source Markdown has strong-emphasis spans that cannot be safely balanced after paragraph insertion")
    if markdown_checks["heading_level_jumps"]:
        warnings.append("rendered Markdown contains heading-level jumps; inspect structure")
    if not markdown_checks["ok"]:
        warnings.append("rendered Markdown structure check failed")

    formal_release = (
        not unreviewed
        and not missing_decision_coverage
        and not prose_over_hard
        and not nonprose_overlong
        and not pivotal_standalone_violations
        and not unbalanced_markdown_blocks
        and integrity_ok
        and coverage["ok"]
        and markdown_checks["ok"]
    )

    report = {
        "schema_version": VERSION,
        "architecture": "agent-first",
        "script_semantic_autonomy": False,
        "runtime_dependencies": [],
        "formal_release": formal_release,
        "source_file": str(source_path),
        "source_format": manifest.get("source_format", "plain"),
        "output_file": str(output_path),
        "manifest_file": str(manifest_path),
        "source_sha256": manifest["source_sha256"],
        "source_canonical_sha256": manifest["source_canonical_sha256"],
        "emitted_payload_canonical_sha256": sha256_text(canonical(emitted_payload)),
        "output_sha256": sha256_text(output),
        "content_integrity": integrity_ok,
        "span_coverage": coverage,
        "markdown_structure": markdown_checks,
        "reviewed_packets": len(reviewed),
        "total_packets": len(packet_ids),
        "unreviewed_packets": unreviewed,
        "missing_agent_decision_units": sorted(missing_decision_coverage),
        "agent_decisions": len(decisions),
        "agent_selected_internal_splits": selected_splits,
        "pivotal_units": len(pivotal_units),
        "pivotal_standalone_violations": sorted(set(pivotal_standalone_violations)),
        "synthetic_markdown_emphasis_markers": synthetic_markdown_markers,
        "unbalanced_markdown_blocks": unbalanced_markdown_blocks,
        "settings": {"soft_max_chars": soft_max, "hard_max_chars": hard_max, "minimum_chars": None},
        "prose_paragraphs": len(prose_lengths),
        "prose_min_chars": min(prose_lengths) if prose_lengths else 0,
        "prose_median_chars": statistics.median(prose_lengths) if prose_lengths else 0,
        "prose_mean_chars": round(statistics.mean(prose_lengths), 1) if prose_lengths else 0,
        "prose_p95_chars": lengths_sorted[int(0.95 * (len(lengths_sorted) - 1))] if lengths_sorted else 0,
        "prose_max_chars": max(prose_lengths) if prose_lengths else 0,
        "prose_over_soft_max": len(soft_overages),
        "prose_over_hard_max": len(prose_over_hard),
        "longest_same_length_band_run": rhythm_run,
        "longest_under_80_run": short_run,
        "paragraph_bands": {
            "short_lt_140": sum(length < 140 for length in prose_lengths),
            "medium_140_299": sum(140 <= length < 300 for length in prose_lengths),
            "long_300_plus": sum(length >= 300 for length in prose_lengths),
        },
        "nonprose_over_hard_max": nonprose_overlong,
        "warnings": warnings,
    }
    atomic_write(output_path, output)
    atomic_write(report_path, json_dump(report))
    print(json_dump(report), end="")
    return 0


def audit(args: argparse.Namespace) -> int:
    report_path = resolved(args.report)
    report = load_json(report_path)
    output_path = Path(report["output_file"])
    source_path = Path(report["source_file"])
    failures: list[str] = []
    if not output_path.is_file() or sha256_text(output_path.read_text(encoding="utf-8")) != report["output_sha256"]:
        failures.append("output file is missing or changed after render")
    if not source_path.is_file() or sha256_bytes(source_path.read_bytes()) != report["source_sha256"]:
        failures.append("source file is missing or changed after render")
    if not report.get("content_integrity"):
        failures.append("content integrity is not confirmed")
    if not report.get("span_coverage", {}).get("ok"):
        failures.append("source span coverage is not exact")
    if not report.get("markdown_structure", {}).get("ok"):
        failures.append("Markdown structure check failed")
    if report.get("prose_over_hard_max"):
        failures.append("one or more prose paragraphs exceed the hard maximum")
    if report.get("pivotal_standalone_violations"):
        failures.append("one or more pivotal units are not standalone paragraphs")
    if report.get("missing_agent_decision_units"):
        failures.append("one or more editable units lack an explicit Agent decision")
    if args.require_formal and not report.get("formal_release"):
        failures.append("report is not a fully Agent-reviewed formal release")
    result = {
        "passed": not failures,
        "formal_release": report.get("formal_release", False),
        "architecture": report.get("architecture"),
        "script_semantic_autonomy": report.get("script_semantic_autonomy"),
        "failures": failures,
        "warnings": report.get("warnings", []),
    }
    print(json_dump(result), end="")
    return 0 if not failures else 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Agent-first mobile formatter for narrative books")
    subparsers = parser.add_subparsers(dest="command", required=True)

    prepare_parser = subparsers.add_parser("prepare", help="create exact-slice Agent review packets")
    prepare_parser.add_argument("input", type=Path)
    prepare_parser.add_argument("--workspace", type=Path, required=True)
    prepare_parser.add_argument("--lang", choices=["en", "sw"], default="en")
    prepare_parser.add_argument("--source-format", choices=["auto", "plain", "markdown"], default="auto")
    prepare_parser.add_argument("--batch-chars", type=int, default=12000)
    prepare_parser.set_defaults(func=prepare)

    render_parser = subparsers.add_parser("render", help="apply Agent decisions and write Markdown plus QA report")
    render_parser.add_argument("--manifest", type=Path, required=True)
    render_parser.add_argument("--decisions-dir", type=Path)
    render_parser.add_argument("--output", type=Path, required=True)
    render_parser.add_argument("--report", type=Path, required=True)
    render_parser.add_argument("--soft-max-chars", type=int, default=300)
    render_parser.add_argument("--hard-max-chars", type=int, default=420)
    render_parser.add_argument(
        "--allow-unreviewed",
        action="store_true",
        help="preview only: preserve undecided units together; never a formal release",
    )
    render_parser.set_defaults(func=render)

    audit_parser = subparsers.add_parser("audit", help="verify source/output/report integrity")
    audit_parser.add_argument("--report", type=Path, required=True)
    audit_parser.add_argument("--require-formal", action="store_true")
    audit_parser.set_defaults(func=audit)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    if hasattr(args, "batch_chars") and args.batch_chars < 1000:
        parser.error("--batch-chars must be at least 1000")
    try:
        return args.func(args)
    except (FormatterError, OSError, UnicodeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
