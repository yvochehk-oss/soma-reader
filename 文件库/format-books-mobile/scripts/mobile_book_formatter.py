#!/usr/bin/env python3
"""AI-assisted, source-faithful mobile formatter for narrative books."""

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

try:
    from syntok import segmenter as _syntok
except ImportError:  # pragma: no cover - exercised through CLI validation
    _syntok = None


VERSION = 1
WS_RE = re.compile(r"\s+")
SCENE_RE = re.compile(r"^\s*(?:(?:\*\s*){3,}|(?:[-_=]\s*){3,})$")
MARKDOWN_HEADING_RE = re.compile(r"^\s*#{1,6}\s+\S")
HEADING_RE = re.compile(
    r"^\s*(?:(?:book|part|volume|kitabu|sehemu|juzuu)\s+(?:the\s+|ya\s+)?(?:[ivxlcdm]+|\d+|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|kwanza|pili|tatu|nne|tano)\b|"
    r"(?:chapter|sura)\s+(?:ya\s+)?(?:[ivxlcdm]+|\d+)\b|prologue\b|epilogue\b|preface\b|introduction\b|contents\s*$|utangulizi\b|hitimisho\b|yaliyomo\s*$)",
    re.IGNORECASE,
)
LIST_LINE_RE = re.compile(r"^\s*(?:[-*•]\s+|\d+[.)]\s+)")
LETTER_RE = re.compile(r"^\s*(?:dear\s+|my\s+dear\s+)", re.IGNORECASE)
FRONT_TITLE_RE = re.compile(r"^[A-Za-z][A-Za-z'’\-]*(?:\s+[A-Za-z][A-Za-z'’\-]*){0,11}$")
QUOTE_CHARS = '"“”„«»'
IMPORTANCE_VALUES = {"normal", "pivotal_dialogue", "pivotal_description", "pivotal_interiority", "scene_turn"}
MANDATORY_STANDALONE = {"pivotal_dialogue", "pivotal_description", "pivotal_interiority"}
DECISION_KEYS = {
    "unit_id",
    "importance",
    "standalone",
    "break_before",
    "break_after",
    "keep_with_next",
    "split_after_offsets",
    "reason",
}


class FormatterError(RuntimeError):
    pass


@dataclass
class Fragment:
    text: str
    unit_id: str
    decision: dict[str, Any]


def canonical(text: str) -> str:
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


def classify_block(text: str, index: int) -> str:
    stripped = text.strip()
    lines = [line for line in stripped.splitlines() if line.strip()]
    if len(lines) == 1 and MARKDOWN_HEADING_RE.match(stripped):
        return "markdown_heading"
    if SCENE_RE.fullmatch(stripped):
        return "scene_break"
    if lines and (LETTER_RE.match(lines[0]) or re.match(r"^\s*yours\s+(?:truly|sincerely)\b", lines[-1], re.I)):
        return "letter"
    if lines and all(LIST_LINE_RE.match(line) for line in lines):
        return "list"
    if len(stripped) <= 180 and HEADING_RE.match(stripped):
        return "heading"
    if index < 8 and len(stripped) <= 96 and not re.search(r"[.!?;:]", stripped):
        words = re.findall(r"[A-Za-z]+(?:['’][A-Za-z]+)?", stripped)
        if stripped.isupper() or (FRONT_TITLE_RE.fullmatch(stripped) and words and all(w[:1].isupper() for w in words)):
            return "heading"
    if len(lines) >= 3:
        short_ratio = sum(word_count(line) <= 9 for line in lines) / len(lines)
        punctuated_ratio = sum(bool(re.search(r"[.!?;,:—-]\s*$", line)) for line in lines) / len(lines)
        if short_ratio >= 0.85 and punctuated_ratio >= 0.35:
            return "poetry"
    return "prose"


def split_blocks(text: str) -> list[dict[str, Any]]:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    blocks: list[dict[str, Any]] = []
    for source_index, raw in enumerate(re.split(r"\n\s*\n", normalized)):
        if not raw.strip():
            continue
        value = raw.strip()
        blocks.append(
            {
                "id": f"b{len(blocks) + 1:05d}",
                "source_index": source_index,
                "kind": classify_block(value, len(blocks)),
                "text": value,
                "unit_ids": [],
            }
        )
    if canonical(normalized) != canonical("\n\n".join(block["text"] for block in blocks)):
        raise FormatterError("internal block parser changed non-whitespace source characters")
    return blocks


def fallback_boundaries(text: str) -> list[int]:
    boundaries: list[int] = []
    pattern = r"[.!?]+(?:[\"”’»)]*)?(?=\s+|$)"
    for match in re.finditer(pattern, text):
        boundaries.append(match.end())
    return boundaries


def syntok_boundaries(text: str) -> list[int]:
    if _syntok is None:
        raise FormatterError("syntok is required; install it with: python -m pip install syntok")
    boundaries: list[int] = []
    for paragraph in _syntok.process(text):
        for sentence in paragraph:
            if not sentence:
                continue
            last = sentence[-1]
            end = last.offset + len(last.value)
            while end < len(text) and text[end] in '"”’»)]':
                end += 1
            boundaries.append(end)
    return boundaries


def sentence_parts(text: str, engine: str) -> list[str]:
    boundaries = syntok_boundaries(text) if engine == "syntok" else fallback_boundaries(text)
    boundaries = sorted({point for point in boundaries if 0 < point <= len(text)})
    parts: list[str] = []
    start = 0
    for end in boundaries:
        if end <= start:
            continue
        piece = text[start:end].strip()
        if piece:
            parts.append(piece)
        start = end
    tail = text[start:].strip()
    if tail:
        parts.append(tail)
    if not parts:
        parts = [text.strip()]
    if canonical(text) != canonical(" ".join(parts)):
        raise FormatterError("sentence segmentation changed non-whitespace source characters")
    return parts


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
            quoted_chars += 1 if quoted else 0
            quoted = False
        elif char == '"':
            straight_open = not straight_open
            quoted = straight_open
        elif quoted:
            quoted_chars += 1
    return round(quoted_chars / max(1, len(text)), 3)


def long_sentence_candidates(text: str) -> list[dict[str, Any]]:
    normalized = inline(text)
    if len(normalized) <= 280:
        return []
    candidates: list[dict[str, Any]] = []
    for match in re.finditer(r"[;:—,.!?]", normalized):
        offset = match.end()
        if offset < 60 or len(normalized) - offset < 40:
            continue
        candidates.append(
            {
                "offset": offset,
                "punctuation": match.group(),
                "left_context": normalized[max(0, offset - 70) : offset],
                "right_context": normalized[offset : offset + 70].lstrip(),
            }
        )
    return candidates


def make_unit(unit_id: str, block: dict[str, Any], index: int, text: str, editable: bool) -> dict[str, Any]:
    normalized = inline(text)
    dialogue = any(char in normalized for char in QUOTE_CHARS)
    scene_terms = bool(
        re.search(
            r"\b(?:suddenly|at once|in that moment|for the first time|the next morning|that night|meanwhile|without warning)\b",
            normalized,
            re.I,
        )
    )
    if dialogue and ("?" in normalized or "!" in normalized or len(normalized) <= 140):
        hint = "review_dialogue"
    elif scene_terms:
        hint = "review_scene_turn"
    else:
        hint = "normal"
    return {
        "id": unit_id,
        "block_id": block["id"],
        "index_in_block": index,
        "block_kind": block["kind"],
        "editable": editable,
        "text": text,
        "display_text": normalized,
        "chars": len(normalized),
        "dialogue": dialogue,
        "quote_ratio": quote_ratio(normalized),
        "question": "?" in normalized,
        "exclamation": "!" in normalized,
        "heuristic_hint": hint,
        "split_candidates": long_sentence_candidates(normalized) if editable else [],
    }


def build_units(blocks: list[dict[str, Any]], engine: str) -> list[dict[str, Any]]:
    units: list[dict[str, Any]] = []
    for block in blocks:
        parts = sentence_parts(block["text"], engine) if block["kind"] == "prose" else [block["text"]]
        for index, part in enumerate(parts):
            unit_id = f"u{len(units) + 1:07d}"
            unit = make_unit(unit_id, block, index, part, block["kind"] == "prose")
            units.append(unit)
            block["unit_ids"].append(unit_id)
    if canonical("\n\n".join(block["text"] for block in blocks)) != canonical(" ".join(unit["text"] for unit in units)):
        raise FormatterError("unit construction changed non-whitespace source characters")
    return units


def packetize(units: list[dict[str, Any]], batch_chars: int) -> list[list[dict[str, Any]]]:
    packets: list[list[dict[str, Any]]] = []
    current: list[dict[str, Any]] = []
    count = 0
    for unit in units:
        length = unit["chars"]
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
    raw = raw_bytes.decode("utf-8-sig")
    removed_zero_width = raw.count("\ufeff")
    source = raw.replace("\ufeff", "")
    source_format = args.source_format
    if source_format == "auto":
        source_format = "markdown" if source_path.suffix.lower() in {".md", ".markdown"} else "plain"
    blocks = split_blocks(source)
    units = build_units(blocks, args.engine)
    groups = packetize(units, args.batch_chars)
    packet_meta: list[dict[str, Any]] = []

    for index, group in enumerate(groups):
        packet_id = f"p{index + 1:04d}"
        first_position = units.index(group[0])
        last_position = units.index(group[-1])
        packet = {
            "schema_version": VERSION,
            "packet_id": packet_id,
            "instructions": (
                "Read every unit in order. Mark only meaningful emphasis or boundary overrides. "
                "Never rewrite text. Return a decision JSON that follows references/decision-protocol.md."
            ),
            "context_before": units[first_position - 1]["display_text"] if first_position else "",
            "context_after": units[last_position + 1]["display_text"] if last_position + 1 < len(units) else "",
            "units": [
                {
                    key: unit[key]
                    for key in (
                        "id",
                        "block_id",
                        "block_kind",
                        "editable",
                        "display_text",
                        "chars",
                        "dialogue",
                        "quote_ratio",
                        "question",
                        "exclamation",
                        "heuristic_hint",
                        "split_candidates",
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
                "chars": sum(unit["chars"] for unit in group),
            }
        )

    manifest = {
        "schema_version": VERSION,
        "source_file": str(source_path),
        "source_sha256": sha256_bytes(raw_bytes),
        "source_canonical_sha256": sha256_text(canonical(source)),
        "source_chars": len(source),
        "source_non_ws": len(canonical(source)),
        "removed_zero_width": removed_zero_width,
        "sentence_engine": args.engine,
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
        "packets": len(packet_meta),
        "blocks": len(blocks),
        "units": len(units),
        "source_non_ws": len(canonical(source)),
        "source_format": source_format,
        "next_step": "Review every packet and write one reviewed decision file per packet into decisions/.",
    }
    print(json_dump(summary), end="")
    return 0


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise FormatterError(f"cannot read valid JSON from {path}: {exc}") from exc


def load_decisions(manifest: dict[str, Any], decisions_dir: Path) -> tuple[dict[str, dict[str, Any]], set[str]]:
    packet_ids = {packet["id"] for packet in manifest["packets"]}
    unit_map = {unit["id"]: unit for unit in manifest["units"] if unit["editable"]}
    decisions: dict[str, dict[str, Any]] = {}
    reviewed: set[str] = set()
    for path in sorted(decisions_dir.glob("*.json")):
        data = load_json(path)
        packet_id = data.get("packet_id")
        if packet_id not in packet_ids:
            raise FormatterError(f"unknown packet_id in {path}: {packet_id!r}")
        if data.get("reviewed") is not True:
            raise FormatterError(f"decision file must set reviewed=true: {path}")
        if packet_id in reviewed:
            raise FormatterError(f"duplicate decision file for packet {packet_id}")
        reviewed.add(packet_id)
        for decision in data.get("decisions", []):
            unknown = set(decision) - DECISION_KEYS
            if unknown:
                raise FormatterError(f"unknown decision keys for {decision.get('unit_id')}: {sorted(unknown)}")
            unit_id = decision.get("unit_id")
            if unit_id not in unit_map:
                raise FormatterError(f"decision references unknown or non-prose unit: {unit_id!r}")
            if unit_id in decisions:
                raise FormatterError(f"duplicate decision for unit {unit_id}")
            importance = decision.get("importance", "normal")
            if importance not in IMPORTANCE_VALUES:
                raise FormatterError(f"invalid importance for {unit_id}: {importance!r}")
            for key in ("standalone", "break_before", "break_after", "keep_with_next"):
                if key in decision and not isinstance(decision[key], bool):
                    raise FormatterError(f"{key} must be boolean for {unit_id}")
            if importance in MANDATORY_STANDALONE and decision.get("standalone") is False:
                raise FormatterError(f"pivotal unit {unit_id} cannot set standalone=false")
            if importance in MANDATORY_STANDALONE and decision.get("keep_with_next") is True:
                raise FormatterError(f"pivotal unit {unit_id} cannot set keep_with_next=true")
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
    return decisions, reviewed


def split_long_text(text: str, hard_max: int, preferred_offsets: list[int] | None = None) -> tuple[list[str], dict[str, Any]]:
    value = inline(text)
    if len(value) <= hard_max:
        return [value], {"model_offsets": [], "automatic_offsets": []}
    pieces: list[str] = []
    minimum = max(60, hard_max // 2)
    start = 0
    preferred = preferred_offsets or []
    used_model: list[int] = []
    used_automatic: list[int] = []
    while len(value) - start > hard_max:
        preferred_eligible = [point for point in preferred if start + minimum <= point <= start + hard_max]
        if preferred_eligible:
            point = preferred_eligible[-1]
            used_model.append(point)
        else:
            window_end = start + hard_max
            punctuation: list[tuple[float, int]] = []
            desired = min(300, int(hard_max * 0.8))
            for match in re.finditer(r"[;:—,.!?]", value[start:window_end + 1]):
                point_candidate = start + match.end()
                length = point_candidate - start
                if length < minimum:
                    continue
                weak_penalty = 85 if match.group() == "," else 0
                punctuation.append((abs(length - desired) + weak_penalty, point_candidate))
            if punctuation:
                _, point = min(punctuation, key=lambda item: item[0])
            else:
                point = value.rfind(" ", start + minimum, window_end + 1)
            if point <= start:
                raise FormatterError(f"cannot safely split an unbroken token longer than hard max ({hard_max})")
            used_automatic.append(point)
        if point <= start:
            raise FormatterError(f"cannot safely split an unbroken token longer than hard max ({hard_max})")
        pieces.append(value[start:point].strip())
        start = point
        while start < len(value) and value[start].isspace():
            start += 1
    if start < len(value):
        pieces.append(value[start:].strip())
    if canonical(value) != canonical(" ".join(pieces)):
        raise FormatterError("emergency split changed non-whitespace characters")
    return pieces, {"model_offsets": used_model, "automatic_offsets": used_automatic}


def band(length: int) -> str:
    if length < 140:
        return "short"
    if length < 300:
        return "medium"
    return "long"


def paragraphize(
    units: list[dict[str, Any]],
    decisions: dict[str, dict[str, Any]],
    soft_max: int,
    hard_max: int,
    minimum: int,
    targets: list[int],
    joiner: str,
    rhythm_index: int,
    last_band: str | None,
) -> tuple[list[list[Fragment]], int, str | None, list[dict[str, Any]]]:
    fragments: list[Fragment] = []
    emergency_splits: list[dict[str, Any]] = []
    for unit in units:
        decision = decisions.get(unit["id"], {})
        pieces, split_detail = split_long_text(unit["text"], hard_max, decision.get("split_after_offsets"))
        if len(pieces) > 1:
            emergency_splits.append(
                {
                    "unit_id": unit["id"],
                    "original_chars": len(inline(unit["text"])),
                    "pieces": pieces,
                    **split_detail,
                }
            )
        for piece in pieces:
            fragments.append(Fragment(piece, unit["id"], decision))

    has_model_boundary = any(
        item.decision.get("standalone")
        or item.decision.get("break_before")
        or item.decision.get("break_after")
        or item.decision.get("importance", "normal") != "normal"
        for item in fragments
    )
    if len(joiner.join(item.text for item in fragments)) <= soft_max and not has_model_boundary:
        length = len(joiner.join(item.text for item in fragments))
        return [fragments], rhythm_index + 1, band(length), emergency_splits

    output: list[list[Fragment]] = []
    index = 0
    while index < len(fragments):
        current = fragments[index]
        importance = current.decision.get("importance", "normal")
        pivotal = importance in MANDATORY_STANDALONE
        standalone = pivotal or current.decision.get("standalone", False)
        if standalone:
            group = [current]
            output.append(group)
            last_band = band(len(current.text))
            rhythm_index += 1
            index += 1
            continue

        target = targets[rhythm_index % len(targets)]
        candidates: list[tuple[float, int, int]] = []
        length = 0
        end = index
        while end < len(fragments):
            item = fragments[end]
            if end > index and (item.decision.get("break_before") or item.decision.get("standalone") or item.decision.get("importance", "normal") != "normal"):
                break
            proposed = length + (len(joiner) if length else 0) + len(item.text)
            if proposed > hard_max:
                break
            length = proposed
            forced_after = item.decision.get("break_after", False)
            keep_with_next = item.decision.get("keep_with_next", False)
            if not keep_with_next or forced_after or end == len(fragments) - 1:
                score = abs(length - target)
                if length < minimum and end < len(fragments) - 1:
                    score += minimum - length
                if last_band == band(length):
                    score += 70
                if forced_after:
                    score -= 1000
                candidates.append((score, end, length))
            if forced_after:
                break
            end += 1

        if not candidates:
            candidates.append((0, index, len(current.text)))
        _, chosen, chosen_length = min(candidates, key=lambda item: item[0])
        output.append(fragments[index : chosen + 1])
        last_band = band(chosen_length)
        rhythm_index += 1
        index = chosen + 1
    return output, rhythm_index, last_band, emergency_splits


def heading_prefix(text: str) -> str:
    if re.match(r"^\s*(?:book|part|volume|kitabu|sehemu|juzuu)\b", text, re.I):
        return "#"
    if re.match(r"^\s*(?:chapter|sura|prologue|epilogue|preface|introduction|utangulizi|hitimisho)\b", text, re.I):
        return "##"
    return "#"


def parse_targets(value: str, hard_max: int) -> list[int]:
    try:
        targets = [int(item.strip()) for item in value.split(",") if item.strip()]
    except ValueError as exc:
        raise FormatterError("targets must be comma-separated integers") from exc
    if len(targets) < 3 or any(item <= 0 or item > hard_max for item in targets):
        raise FormatterError("provide at least three positive rhythm targets no greater than hard max")
    return targets


def longest_same_band_run(lengths: list[int]) -> int:
    longest = current = 0
    previous: str | None = None
    for length in lengths:
        value = band(length)
        current = current + 1 if value == previous else 1
        previous = value
        longest = max(longest, current)
    return longest


def repair_markdown_emphasis(paragraphs: list[str]) -> tuple[list[str], int, bool]:
    """Close and reopen source ** spans split by inserted paragraph boundaries."""
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


def render(args: argparse.Namespace) -> int:
    manifest_path = resolved(args.manifest)
    manifest = load_json(manifest_path)
    source_path = Path(manifest["source_file"])
    output_path = resolved(args.output)
    report_path = resolved(args.report)
    require_distinct({"input": source_path, "output": output_path, "report": report_path})
    if output_path.suffix.lower() != ".md":
        raise FormatterError("mobile publication output must use the .md extension")
    raw_bytes = source_path.read_bytes()
    if sha256_bytes(raw_bytes) != manifest["source_sha256"]:
        raise FormatterError("source file changed after prepare; create a new workspace")
    raw = raw_bytes.decode("utf-8-sig")
    source = raw.replace("\ufeff", "")
    if sha256_text(canonical(source)) != manifest["source_canonical_sha256"]:
        raise FormatterError("source canonical checksum no longer matches manifest")

    decisions_dir = resolved(args.decisions_dir or manifest_path.parent / "decisions")
    decisions, reviewed = load_decisions(manifest, decisions_dir)
    packet_ids = {packet["id"] for packet in manifest["packets"]}
    unreviewed = sorted(packet_ids - reviewed)
    if unreviewed and not args.allow_unreviewed:
        raise FormatterError(
            f"{len(unreviewed)} packets have not been reviewed; first missing: {', '.join(unreviewed[:5])}"
        )

    soft_max = args.soft_max_chars
    hard_max = args.hard_max_chars
    minimum = args.min_chars
    if not (1 <= minimum < soft_max <= hard_max):
        raise FormatterError("require 1 <= min chars < soft max chars <= hard max chars")
    targets = parse_targets(args.rhythm_targets, soft_max)
    joiner = " "
    unit_map = {unit["id"]: unit for unit in manifest["units"]}
    output_parts: list[str] = []
    payload_parts: list[str] = []
    prose_lengths: list[int] = []
    nonprose_overlong: list[dict[str, Any]] = []
    emergency_split_review: list[dict[str, Any]] = []
    emphasized = 0
    pivotal_units = {
        unit_id
        for unit_id, decision in decisions.items()
        if decision.get("importance", "normal") in MANDATORY_STANDALONE
    }
    pivotal_standalone_violations: list[str] = []
    synthetic_markdown_markers = 0
    unbalanced_markdown_blocks: list[str] = []
    rhythm_index = 0
    last_band: str | None = None

    for block in manifest["blocks"]:
        units = [unit_map[unit_id] for unit_id in block["unit_ids"]]
        kind = block["kind"]
        if kind == "prose":
            groups, rhythm_index, last_band, local_splits = paragraphize(
                units,
                decisions,
                soft_max,
                hard_max,
                minimum,
                targets,
                joiner,
                rhythm_index,
                last_band,
            )
            emergency_split_review.extend(local_splits)
            raw_values = [joiner.join(fragment.text for fragment in group).strip() for group in groups]
            display_values = raw_values
            if manifest.get("source_format", "plain") == "markdown":
                display_values, local_markers, remains_open = repair_markdown_emphasis(raw_values)
                synthetic_markdown_markers += local_markers
                if remains_open:
                    unbalanced_markdown_blocks.append(block["id"])
            for group, value, display_value in zip(groups, raw_values, display_values):
                output_parts.append(display_value)
                payload_parts.append(value)
                prose_lengths.append(len(value))
                if any(fragment.decision.get("importance", "normal") != "normal" for fragment in group):
                    emphasized += 1
                pivotal_in_group = {fragment.unit_id for fragment in group if fragment.unit_id in pivotal_units}
                if pivotal_in_group and (len(group) != 1 or len(pivotal_in_group) != 1):
                    pivotal_standalone_violations.extend(sorted(pivotal_in_group))
        else:
            text = block["text"].strip()
            payload_parts.append(text)
            if kind == "heading":
                output_parts.append(f"{heading_prefix(text)} {text}")
            elif kind == "markdown_heading":
                output_parts.append(text)
            elif kind in {"poetry", "letter"}:
                output_parts.append("  \n".join(line.rstrip() for line in text.splitlines()))
            else:
                output_parts.append(text)
            if kind not in {"heading", "scene_break"}:
                # Multi-line non-prose structures render one visual line at a time.
                # Measuring the whole block incorrectly rejects readable Markdown
                # lists, letters, and poetry whose individual lines are all safe.
                visible_segments = (
                    [line.strip() for line in text.splitlines() if line.strip()]
                    if kind in {"list", "poetry", "letter"}
                    else [text]
                )
                longest_visible_segment = max((visible_length(value) for value in visible_segments), default=0)
                if longest_visible_segment > hard_max:
                    nonprose_overlong.append(
                        {"block_id": block["id"], "kind": kind, "chars": longest_visible_segment}
                    )

    output = "\n\n".join(output_parts) + ("\n" if output_parts else "")
    # Some source manuscripts attach a chapter marker directly to the preceding
    # sentence (for example, ``...ending.# Chapter 2`` or ``...mwisho.# Sura ya
    # 2``). A Markdown heading is only a heading at the start of a line, so
    # restore the missing whitespace without changing any source character or
    # its order. Excluding ``#`` in the lookbehind is important: otherwise the
    # second marker in a valid ``## Sura ...`` heading would be split apart.
    output = re.sub(
        r"(?<![#\n])# (?=(?:chapter|sura)\b)",
        "\n\n# ",
        output,
        flags=re.IGNORECASE,
    )
    emitted_payload = "\n\n".join(payload_parts)
    integrity_ok = canonical(source) == canonical(emitted_payload)
    prose_violations = [length for length in prose_lengths if length > hard_max]
    if not integrity_ok:
        raise FormatterError("payload integrity failed; output was not written")
    if prose_violations:
        raise FormatterError(f"{len(prose_violations)} prose paragraphs exceed hard max; output was not written")

    lengths_sorted = sorted(prose_lengths)
    rhythm_run = longest_same_band_run(prose_lengths)
    warnings = (["heuristic preview only: not every packet received model review"] if unreviewed else [])
    if emergency_split_review and not args.ack_emergency_splits:
        warnings.append(
            f"{len(emergency_split_review)} emergency long-sentence splits require manual inspection and explicit acknowledgement"
        )
    if nonprose_overlong:
        warnings.append("some non-prose blocks exceed the hard maximum; inspect the listed structures")
    if rhythm_run > 8:
        warnings.append(f"the output contains a run of {rhythm_run} paragraphs in the same length band; inspect its reading rhythm")
    if unbalanced_markdown_blocks:
        warnings.append("source Markdown contains unbalanced strong-emphasis markers in one or more blocks")
    formal_release = (
        not unreviewed
        and not prose_violations
        and not nonprose_overlong
        and not pivotal_standalone_violations
        and not unbalanced_markdown_blocks
        and integrity_ok
        and (not emergency_split_review or args.ack_emergency_splits)
    )
    report = {
        "schema_version": VERSION,
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
        "reviewed_packets": len(reviewed),
        "total_packets": len(packet_ids),
        "unreviewed_packets": unreviewed,
        "model_decisions": len(decisions),
        "emphasized_paragraphs": emphasized,
        "pivotal_units": len(pivotal_units),
        "pivotal_standalone_violations": sorted(set(pivotal_standalone_violations)),
        "synthetic_markdown_emphasis_markers": synthetic_markdown_markers,
        "unbalanced_markdown_blocks": unbalanced_markdown_blocks,
        "settings": {
            "soft_max_chars": soft_max,
            "hard_max_chars": hard_max,
            "min_chars": minimum,
            "rhythm_targets": targets,
        },
        "prose_paragraphs": len(prose_lengths),
        "prose_min_chars": min(prose_lengths) if prose_lengths else 0,
        "prose_median_chars": statistics.median(prose_lengths) if prose_lengths else 0,
        "prose_mean_chars": round(statistics.mean(prose_lengths), 1) if prose_lengths else 0,
        "prose_p95_chars": lengths_sorted[int(0.95 * (len(lengths_sorted) - 1))] if lengths_sorted else 0,
        "prose_max_chars": max(prose_lengths) if prose_lengths else 0,
        "prose_over_hard_max": len(prose_violations),
        "emergency_safe_splits": len(emergency_split_review),
        "emergency_splits_acknowledged": bool(args.ack_emergency_splits),
        "emergency_split_review": emergency_split_review,
        "longest_same_length_band_run": rhythm_run,
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
    if report.get("prose_over_hard_max"):
        failures.append("one or more prose paragraphs exceed the hard maximum")
    if report.get("pivotal_standalone_violations"):
        failures.append("one or more pivotal units are not standalone paragraphs")
    if report.get("unbalanced_markdown_blocks"):
        failures.append("source Markdown strong-emphasis markers remain unbalanced")
    if args.require_formal and not report.get("formal_release"):
        failures.append("report is a preview, not a fully model-reviewed formal release")
    result = {
        "passed": not failures,
        "formal_release": report.get("formal_release", False),
        "failures": failures,
        "warnings": report.get("warnings", []),
    }
    print(json_dump(result), end="")
    return 0 if not failures else 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="AI-assisted mobile formatter for narrative books")
    subparsers = parser.add_subparsers(dest="command", required=True)

    prepare_parser = subparsers.add_parser("prepare", help="create model-review packets without changing the source")
    prepare_parser.add_argument("input", type=Path)
    prepare_parser.add_argument("--workspace", type=Path, required=True)
    prepare_parser.add_argument("--engine", choices=["syntok", "fallback"], default="syntok")
    prepare_parser.add_argument("--source-format", choices=["auto", "plain", "markdown"], default="auto")
    prepare_parser.add_argument("--batch-chars", type=int, default=12000)
    prepare_parser.set_defaults(func=prepare)

    render_parser = subparsers.add_parser("render", help="apply reviewed decisions and write Markdown plus QA report")
    render_parser.add_argument("--manifest", type=Path, required=True)
    render_parser.add_argument("--decisions-dir", type=Path)
    render_parser.add_argument("--output", type=Path, required=True)
    render_parser.add_argument("--report", type=Path, required=True)
    render_parser.add_argument("--soft-max-chars", type=int, default=300)
    render_parser.add_argument("--hard-max-chars", type=int, default=360)
    render_parser.add_argument("--min-chars", type=int, default=70)
    render_parser.add_argument("--rhythm-targets", default="180,100,240,140,280,160")
    render_parser.add_argument(
        "--ack-emergency-splits",
        action="store_true",
        help="confirm every emergency split was manually inspected; required for formal release when splits exist",
    )
    render_parser.add_argument("--allow-unreviewed", action="store_true", help="write a heuristic preview, never a formal release")
    render_parser.set_defaults(func=render)

    audit_parser = subparsers.add_parser("audit", help="verify that source and rendered files still match the QA report")
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
