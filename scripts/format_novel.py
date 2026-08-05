#!/usr/bin/env python3
"""Lossless, deterministic mobile formatting for English novels.

Only whitespace may be changed. Use --verify-integrity strict for production.
Sentence segmentation prefers syntok; a conservative built-in scanner is used
when syntok is unavailable.
"""
from __future__ import annotations

import argparse, json, re, sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

try:
    from syntok import segmenter as _syntok
    SYNTOK_AVAILABLE = True
except ImportError:
    _syntok = None
    SYNTOK_AVAILABLE = False

SCENE_RE = re.compile(r"^\s*(?:\*\s*){3,}$|^\s*(?:[-_=])(?:\s*[-_=]){2,}\s*$")
HEADING_RE = re.compile(r"^\s*(?:chapter|part|book|volume|prologue|epilogue|preface|introduction|contents)\b.*$", re.I)
QUOTE_START_RE = re.compile(r"^\s*(?:[\"“‘]|—|--\s)")
GUTENBERG_START = re.compile(r"\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK", re.I)
GUTENBERG_END = re.compile(r"\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK", re.I)

@dataclass
class Block:
    kind: str
    text: str
    source_index: int

@dataclass
class Report:
    input_file: str
    output_file: str
    sentence_engine: str
    input_chars: int
    output_chars: int
    input_non_ws: int
    output_non_ws: int
    input_words: int
    output_words: int
    input_blocks: int
    output_blocks: int
    dropped_non_ws: int
    duplicated_non_ws: int
    warnings: list[str]
    errors: list[str]

def canon(s: str) -> str:
    return re.sub(r"[\s#]+", "", s)

def words(s: str) -> int:
    return len(re.findall(r"\b[\w’'-]+\b", s, re.UNICODE))

def classify(text: str) -> str:
    t = text.strip()
    if not t: return "blank"
    if SCENE_RE.match(t): return "scene_break"
    if GUTENBERG_START.match(t) or GUTENBERG_END.match(t): return "metadata"
    if HEADING_RE.match(t): return "heading"
    if re.match(r"^(?:dear\s+|my\s+dear\s+|yours\s+(?:truly|sincerely))\b", t, re.I): return "letter"
    if re.match(r"^(?:[-*•]\s+|\d+[.)]\s+)", t): return "list"
    if QUOTE_START_RE.match(t) or (t.count('“') != t.count('”')): return "dialogue"
    # Preserve likely verse/lyrics: multiple short physical lines.
    lines = [x.strip() for x in text.splitlines() if x.strip()]
    # Gutenberg prose is often wrapped at 60-72 columns, so <=12 words is
    # much too broad. Keep only compact verse-like blocks here.
    if len(lines) >= 2 and sum(words(x) <= 8 for x in lines) / len(lines) >= .8:
        return "poetry"
    return "prose"

def read_blocks(text: str) -> list[Block]:
    raw = re.split(r"\n\s*\n", text.replace("\r\n", "\n").replace("\r", "\n"))
    return [Block(classify(x), x.strip(), i) for i, x in enumerate(raw) if x.strip()]

def fallback_sentences(text: str) -> list[str]:
    """Conservative scanner: avoids initials, decimals, ellipses and quotes."""
    out, start, i = [], 0, 0
    while i < len(text):
        if text[i] in ".!?":
            if text[i] == "." and ((i + 1 < len(text) and text[i+1] == ".") or
                (i and i + 2 < len(text) and text[i-1].isalpha() and text[i+1].isalpha())):
                i += 1; continue
            j = i + 1
            while j < len(text) and text[j] in "\"'”’)]": j += 1
            if j == len(text) or text[j].isspace():
                out.append(text[start:j].strip()); start = j
                while start < len(text) and text[start].isspace(): start += 1
                i = start; continue
        i += 1
    tail = text[start:].strip()
    if tail: out.append(tail)
    return out

def split_sentences(text: str) -> list[str]:
    if SYNTOK_AVAILABLE:
        result = []
        for paragraph in _syntok.process(text):
            for sentence in paragraph:
                # Syntok token values are normalized for tokenisation.  Use
                # only its boundaries, then slice the original text by token
                # offsets: this preserves every source character exactly.
                start = sentence[0].offset
                final = sentence[-1]
                value = text[start: final.offset + len(final.value)].strip()
                if value: result.append(value)
        if result: return result
    return fallback_sentences(text)

def format_prose(text: str, target: int, maximum: int, max_sentences: int) -> list[str]:
    # Physical newlines in prose are layout noise; this is the only place they
    # are flattened. All non-whitespace characters remain in the same order.
    flat = re.sub(r"\s+", " ", text).strip()
    sentences = split_sentences(flat)
    if not sentences: return []
    result, current, count = [], [], 0
    for s in sentences:
        n = words(s)
        if current and (sum(words(x) for x in current) + n > maximum or count >= max_sentences):
            result.append(" ".join(current)); current, count = [], 0
        current.append(s); count += 1
        if sum(words(x) for x in current) >= target:
            result.append(" ".join(current)); current, count = [], 0
    if current: result.append(" ".join(current))
    return result

def format_novel(text: str, target: int, maximum: int, max_sentences: int) -> tuple[str, dict]:
    blocks = read_blocks(text)
    out: list[str] = []
    kinds: dict[str, int] = {}
    for block in blocks:
        kinds[block.kind] = kinds.get(block.kind, 0) + 1
        if block.kind in {"prose"}:
            out.extend(format_prose(block.text, target, maximum, max_sentences))
        elif block.kind == "poetry":
            out.append("\n".join(x.rstrip() for x in block.text.splitlines()))
        elif block.kind == "heading":
            t = re.sub(r"[ \t]+", " ", block.text).strip()
            if t.isupper() or t.lower().startswith(("book", "part", "volume")):
                out.append(f"# {t}")
            else:
                out.append(f"## {t}")
        else:
            # Headings and scene markers retain their shape; metadata and
            # dialogue are otherwise Gutenberg-wrapped prose and are safely
            # flattened without changing non-whitespace characters.
            if block.kind in {"dialogue", "metadata", "letter", "list"}:
                out.append(re.sub(r"\s+", " ", block.text).strip())
            else:
                out.append(re.sub(r"[ \t]+", " ", block.text).strip())
    return "\n\n".join(out) + ("\n" if out else ""), kinds

def main() -> int:
    global SYNTOK_AVAILABLE
    p = argparse.ArgumentParser(description="Lossless deterministic mobile novel formatter")
    p.add_argument("input", type=Path, help="source UTF-8 text file")
    p.add_argument("-o", "--output", type=Path, required=True)
    p.add_argument("--report", type=Path)
    # Modern English web-fiction defaults: compact paragraphs, readable on a
    # phone, while retaining dialogue as a unit whenever it fits.
    p.add_argument("--target-words", type=int, default=28)
    p.add_argument("--max-words", type=int, default=60)
    p.add_argument("--max-sentences", type=int, default=3)
    p.add_argument("--verify-integrity", choices=["strict", "warn", "off"], default="strict")
    p.add_argument("--engine", choices=["auto", "syntok", "fallback"], default="auto")
    args = p.parse_args()
    if not args.input.is_file():
        print(f"error: input file not found: {args.input}", file=sys.stderr); return 2
    if args.target_words <= 0 or args.max_words < args.target_words or args.max_sentences <= 0:
        print("error: require 0 < target-words <= max-words and max-sentences > 0", file=sys.stderr); return 2
    use_syntok = SYNTOK_AVAILABLE and args.engine != "fallback"
    if args.engine == "syntok" and not SYNTOK_AVAILABLE:
        print("error: syntok is not installed; run: python -m pip install syntok", file=sys.stderr); return 2
    raw = args.input.read_text(encoding="utf-8")
    SYNTOK_AVAILABLE = use_syntok
    formatted, kinds = format_novel(raw, args.target_words, args.max_words, args.max_sentences)
    before, after = canon(raw), canon(formatted)
    errors, warnings = [], []
    if before != after:
        errors.append("canonical non-whitespace content differs: loss, duplication, or mutation detected")
    if not SYNTOK_AVAILABLE: warnings.append("syntok unavailable: conservative fallback sentence scanner used")
    if args.verify_integrity == "strict" and errors:
        print("error: strict integrity check failed; output was not written", file=sys.stderr)
        for e in errors: print(f"- {e}", file=sys.stderr)
        return 1
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(formatted, encoding="utf-8")
    report = Report(str(args.input), str(args.output), "syntok" if use_syntok else "fallback",
        len(raw), len(formatted), len(before), len(after), words(raw), words(formatted),
        len(read_blocks(raw)), len(formatted.split("\n\n")) if formatted else 0,
        max(0, len(before)-len(after)), max(0, len(after)-len(before)), warnings, errors)
    data = asdict(report); data["block_kinds"] = kinds
    if args.report: args.report.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(data, ensure_ascii=False, indent=2))
    return 0

if __name__ == "__main__": raise SystemExit(main())

