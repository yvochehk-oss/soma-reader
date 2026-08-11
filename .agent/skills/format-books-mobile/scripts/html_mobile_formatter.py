#!/usr/bin/env python3
"""Agent-first HTML-native mobile formatter for English/Swahili books.

Python standard-library only. The Agent owns semantic paragraph decisions.
This helper exposes sentence/addressable units inside existing HTML <p>
blocks, validates every decision, inserts only paragraph boundaries at safe
raw-source offsets, and proves visible-text payload integrity.

The script does not rewrite prose and does not convert final output to
Markdown or plain text.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import html
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import shutil
import statistics
import sys
import tempfile
import urllib.parse
from typing import Any

# Reuse the bundled zero-dependency candidate segmenter. This is an internal
# skill module, not an external runtime dependency.
import text_candidate_tools as textfmt

VERSION = 4
SKILL_VERSION = "4.3.1-format-only"
VOID_TAGS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
    "meta", "param", "source", "track", "wbr",
}
PROTECTED_ANCESTORS = {"pre", "code", "script", "style", "svg", "math", "table"}
LINE_PRESERVING_TOKENS = {"preserve-lines", "poetry", "poem", "verse", "song", "lyrics"}
BLOCKISH_INSIDE_P = {"div", "section", "article", "aside", "header", "footer", "nav", "ul", "ol", "table", "figure"}
ACTIVE_TAGS = {"script", "iframe", "object", "embed", "form", "base"}
ID_ATTR_RE = re.compile(r"\s+(?:xml:)?id\s*=\s*(?:\"[^\"]*\"|'[^']*'|[^\s>]+)", re.I)
NAME_ATTR_RE = re.compile(r"\s+name\s*=\s*(?:\"[^\"]*\"|'[^']*'|[^\s>]+)", re.I)

MOBILE_CSS = """\n<style id="format-books-mobile-v4.3">\nhtml { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }\nbody { margin: 0; }\nmain.book-source, main.book-mobile, body > main { max-width: 44rem; margin-inline: auto; padding: 1.1rem 1rem 3rem; }\np, p.source-paragraph { line-height: 1.72; margin-block: 0 1.05em; text-wrap: pretty; }\n.mobile-chunk { display: block; }\n.mobile-soft-break { display: block; width: 100%; }\n.mobile-soft-break.sentence { height: 0.65em; }\n.mobile-soft-break.clause { height: 0.28em; }\nh1, h2, h3, h4, h5, h6 { line-height: 1.25; text-wrap: balance; scroll-margin-top: 1rem; }\nblockquote { margin-inline: 1rem 0; }\nimg, svg { max-width: 100%; height: auto; }\npre, table { max-width: 100%; overflow-x: auto; }\n@media (min-width: 48rem) {\n  main.book-source, main.book-mobile, body > main { padding-inline: 1.5rem; }\n}\n</style>\n"""


class FormatterError(RuntimeError):
    pass


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_text(value: str) -> str:
    return sha256_bytes(value.encode("utf-8"))


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


def assert_safe_workspace_replace(workspace: Path, source_path: Path) -> None:
    workspace = workspace.resolve()
    source_path = source_path.resolve()
    if workspace == Path(workspace.anchor) or workspace == Path.home().resolve():
        raise FormatterError(f"refusing --force deletion of protected workspace: {workspace}")
    try:
        source_path.relative_to(workspace)
    except ValueError:
        return
    raise FormatterError(f"refusing --force deletion because workspace contains source file: {source_path}")


def canonical_visible(value: str) -> str:
    # HTML paragraph insertion may add formatting newlines between tags, so
    # compare browser-like visible whitespace runs rather than raw source
    # spacing. Crucially, retain one separator: `New York` must never compare
    # equal to `NewYork`.
    return re.sub(r"\s+", " ", value).strip()


def _line_starts(source: str) -> list[int]:
    starts = [0]
    for match in re.finditer(r"\n", source):
        starts.append(match.end())
    return starts


def _has_line_preserving_semantics(attrs: list[tuple[str, str | None]]) -> bool:
    attr_map = {k.lower(): (v or "") for k, v in attrs}
    classes = {token.casefold() for token in attr_map.get("class", "").split()}
    if LINE_PRESERVING_TOKENS & classes:
        return True
    semantic_values = " ".join((attr_map.get("epub:type", ""), attr_map.get("role", ""))).casefold()
    tokens = {token for token in re.split(r"[^a-z0-9_-]+", semantic_values) if token}
    return bool(LINE_PRESERVING_TOKENS & tokens)


class ParagraphCollector(HTMLParser):
    def __init__(self, source: str) -> None:
        super().__init__(convert_charrefs=False)
        self.source = source
        self.line_starts = _line_starts(source)
        self.stack: list[str] = []
        self.protected_stack: list[bool] = []
        self.paragraphs: list[dict[str, Any]] = []
        self.current: dict[str, Any] | None = None
        self.errors: list[str] = []

    def abspos(self) -> int:
        line, col = self.getpos()
        return self.line_starts[line - 1] + col

    def tag_end(self, start: int) -> int:
        quote: str | None = None
        i = start
        while i < len(self.source):
            ch = self.source[i]
            if quote:
                if ch == quote:
                    quote = None
            elif ch in {'"', "'"}:
                quote = ch
            elif ch == ">":
                return i + 1
            i += 1
        return len(self.source)

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        start = self.abspos()
        raw = self.get_starttag_text() or self.source[start:self.tag_end(start)]
        element_protected = tag in PROTECTED_ANCESTORS or _has_line_preserving_semantics(attrs)
        if tag == "p":
            if self.current is not None:
                self.errors.append(f"nested/unclosed <p> before source offset {start}")
            protected = any(self.protected_stack) or element_protected
            self.current = {
                "start": start,
                "content_start": start + len(raw),
                "start_tag": raw,
                "ancestors": list(self.stack),
                "protected_context": protected,
            }
        if tag not in VOID_TAGS:
            self.stack.append(tag)
            self.protected_stack.append(element_protected)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        pass

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        start = self.abspos()
        if tag == "p" and self.current is not None:
            current = self.current
            current["content_end"] = start
            current["end"] = self.tag_end(start)
            current["end_tag"] = self.source[start:current["end"]]
            self.paragraphs.append(current)
            self.current = None
        for idx in range(len(self.stack) - 1, -1, -1):
            if self.stack[idx] == tag:
                del self.stack[idx:]
                del self.protected_stack[idx:]
                break

    def close(self) -> None:
        super().close()
        if self.current is not None:
            self.errors.append("unclosed <p> at end of document")


class VisibleTextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_body = False
        self.skip_depth = 0
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if tag == "body":
            self.in_body = True
        if self.in_body and tag in {"script", "style", "noscript"}:
            self.skip_depth += 1
        if self.in_body and not self.skip_depth and tag in {"br", "hr"}:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if self.in_body and tag in {"script", "style", "noscript"} and self.skip_depth:
            self.skip_depth -= 1
        if tag == "body":
            self.in_body = False

    def handle_data(self, data: str) -> None:
        if self.in_body and not self.skip_depth:
            self.parts.append(data)

    def text(self) -> str:
        return "".join(self.parts)


def visible_document_text(source: str) -> str:
    parser = VisibleTextExtractor()
    parser.feed(source)
    parser.close()
    return parser.text()


def _tag_token_end(value: str, start: int) -> int:
    if value.startswith("<!--", start):
        end = value.find("-->", start + 4)
        return len(value) if end == -1 else end + 3
    quote: str | None = None
    i = start
    while i < len(value):
        ch = value[i]
        if quote:
            if ch == quote:
                quote = None
        elif ch in {'"', "'"}:
            quote = ch
        elif ch == ">":
            return i + 1
        i += 1
    return len(value)


def _tag_info(token: str) -> tuple[str, str] | None:
    if token.startswith("<!--") or token.startswith("<!") or token.startswith("<?"):
        return None
    match = re.match(r"<\s*(/?)\s*([A-Za-z][\w:.-]*)", token)
    if not match:
        return None
    kind = "end" if match.group(1) else ("self" if token.rstrip().endswith("/>") else "start")
    return kind, match.group(2).lower()


def visible_map(inner_html: str) -> dict[str, Any]:
    """Map decoded visible characters to raw offsets inside one <p> body."""
    visible: list[str] = []
    raw_start_by_char: list[int] = []
    raw_end_by_char: list[int] = []
    depth_by_char = bytearray()
    stack: list[str] = []
    contains_br = False
    contains_blockish = False
    markup_errors: list[str] = []
    i = 0
    while i < len(inner_html):
        ch = inner_html[i]
        if ch == "<":
            end = _tag_token_end(inner_html, i)
            token = inner_html[i:end]
            info = _tag_info(token)
            if info:
                kind, tag = info
                if tag == "br":
                    contains_br = True
                    # Represent a forced line break as whitespace to the candidate splitter.
                    visible.append("\n")
                    raw_start_by_char.append(i)
                    raw_end_by_char.append(end)
                    depth_by_char.append(min(255, len(stack)))
                if tag in BLOCKISH_INSIDE_P:
                    contains_blockish = True
                if kind == "start" and tag not in VOID_TAGS:
                    stack.append(tag)
                elif kind == "end":
                    if not stack:
                        markup_errors.append(f"unexpected closing </{tag}>")
                    elif stack[-1] != tag:
                        markup_errors.append(f"misnested closing </{tag}> while <{stack[-1]}> is open")
                        if tag in stack:
                            idx = len(stack) - 1 - stack[::-1].index(tag)
                            del stack[idx:]
                    else:
                        stack.pop()
            i = end
            continue
        if ch == "&":
            semi = inner_html.find(";", i + 1, min(len(inner_html), i + 48))
            if semi != -1:
                token = inner_html[i:semi + 1]
                decoded = html.unescape(token)
                if decoded != token:
                    for decoded_ch in decoded:
                        visible.append(decoded_ch)
                        raw_start_by_char.append(i)
                        raw_end_by_char.append(semi + 1)
                        depth_by_char.append(min(255, len(stack)))
                    i = semi + 1
                    continue
        visible.append(ch)
        raw_start_by_char.append(i)
        raw_end_by_char.append(i + 1)
        depth_by_char.append(min(255, len(stack)))
        i += 1
    if stack:
        markup_errors.append("unclosed inline tags: " + ", ".join(stack[-8:]))
    return {
        "text": "".join(visible),
        "raw_start_by_char": raw_start_by_char,
        "raw_end_by_char": raw_end_by_char,
        "depth_by_char": depth_by_char,
        "contains_br": contains_br,
        "contains_blockish": contains_blockish,
        "markup_errors": markup_errors,
    }


def _advance_over_closers(inner_html: str, raw_offset: int, depth: int) -> int | None:
    """Move a boundary over source whitespace and immediate closing inline tags.

    Whitespace is attached to the preceding paragraph so newly-created <p>
    elements do not begin with source indentation/spaces. No visible prose is
    moved or rewritten.
    """
    i = raw_offset
    remaining = depth
    while i < len(inner_html):
        if inner_html[i].isspace():
            i += 1
            continue
        if remaining <= 0:
            return i
        if inner_html.startswith("<!--", i):
            end = inner_html.find("-->", i + 4)
            if end == -1:
                return None
            i = end + 3
            continue
        if inner_html.startswith("</", i):
            end = _tag_token_end(inner_html, i)
            token = inner_html[i:end]
            info = _tag_info(token)
            if not info or info[0] != "end":
                return None
            remaining -= 1
            i = end
            # Keep looping so source whitespace after the closing tag is
            # attached to the preceding paragraph too.
            continue
        return None
    return i if remaining <= 0 else None


def safe_raw_offset(mapping: dict[str, Any], inner_html: str, visible_end: int) -> int | None:
    if visible_end <= 0:
        return 0
    if visible_end > len(mapping["raw_end_by_char"]):
        return None
    raw_offset = mapping["raw_end_by_char"][visible_end - 1]
    depth = int(mapping["depth_by_char"][visible_end - 1])
    return _advance_over_closers(inner_html, raw_offset, depth)


def raw_span_for_visible(mapping: dict[str, Any], start: int, end: int) -> tuple[int, int]:
    if start >= end or not mapping["raw_start_by_char"]:
        return 0, 0
    raw_start = mapping["raw_start_by_char"][start]
    raw_end = mapping["raw_end_by_char"][end - 1]
    return raw_start, raw_end


def paragraph_record(source: str, raw: dict[str, Any], index: int, lang: str) -> dict[str, Any]:
    content_start = int(raw["content_start"])
    content_end = int(raw["content_end"])
    inner_html = source[content_start:content_end]
    mapping = visible_map(inner_html)
    visible = mapping["text"]
    editable = not raw["protected_context"] and not mapping["contains_br"] and not mapping["contains_blockish"]
    spans = textfmt.sentence_spans(visible, lang) if editable else []
    if editable and not spans and visible.strip():
        start = next((i for i, ch in enumerate(visible) if not ch.isspace()), 0)
        end = len(visible.rstrip())
        spans = [(start, end)]
    units: list[dict[str, Any]] = []
    for unit_index, (start, end) in enumerate(spans):
        display = visible[start:end]
        raw_start_local, raw_end_local = raw_span_for_visible(mapping, start, end)
        break_local = safe_raw_offset(mapping, inner_html, end)
        unit_id = f"u{index:06d}_{unit_index:04d}"
        long_candidates: list[dict[str, Any]] = []
        for candidate in textfmt.long_sentence_candidates(display, 0):
            visible_offset_in_unit = int(candidate["offset"])
            visible_absolute = start + visible_offset_in_unit
            split_local = safe_raw_offset(mapping, inner_html, visible_absolute)
            if split_local is None or split_local <= raw_start_local or split_local >= content_end - content_start:
                continue
            item = dict(candidate)
            item["offset"] = visible_offset_in_unit
            item["visible_offset"] = visible_absolute
            item["source_offset"] = content_start + split_local
            long_candidates.append(item)
        units.append({
            "id": unit_id,
            "paragraph_id": f"hp{index:06d}",
            "editable": True,
            "display_text": textfmt.inline(display),
            "visible_start": start,
            "visible_end": end,
            "source_start": content_start + raw_start_local,
            "source_end": content_start + raw_end_local,
            "break_after_source_offset": (content_start + break_local) if break_local is not None else None,
            "break_after_safe": break_local is not None,
            "split_candidates": long_candidates,
            "visible_chars": textfmt.visible_length(display),
            "words": textfmt.word_count(display),
        })
    return {
        "id": f"hp{index:06d}",
        "start": int(raw["start"]),
        "content_start": content_start,
        "content_end": content_end,
        "end": int(raw["end"]),
        "start_tag": raw["start_tag"],
        "end_tag": raw["end_tag"],
        "ancestors": raw["ancestors"],
        "protected": not editable,
        "protected_reason": (
            "protected ancestor/context" if raw["protected_context"] else
            "contains <br> / preserve-lines semantics" if mapping["contains_br"] else
            "contains nested block structure" if mapping["contains_blockish"] else None
        ),
        "visible_text": textfmt.inline(visible),
        "visible_chars": textfmt.visible_length(visible),
        "units": units,
        "markup_errors": mapping["markup_errors"],
    }


def packetize(paragraphs: list[dict[str, Any]], batch_chars: int) -> list[list[dict[str, Any]]]:
    editable = [p for p in paragraphs if p["units"]]
    packets: list[list[dict[str, Any]]] = []
    current: list[dict[str, Any]] = []
    size = 0
    for paragraph in editable:
        chars = max(1, int(paragraph["visible_chars"]))
        if current and size + chars > batch_chars:
            packets.append(current)
            current = []
            size = 0
        current.append(paragraph)
        size += chars
    if current:
        packets.append(current)
    return packets


def _neighbor_context(paragraphs: list[dict[str, Any]], paragraph_index: int, direction: int, limit: int = 2) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    i = paragraph_index + direction
    while 0 <= i < len(paragraphs) and len(out) < limit:
        paragraph = paragraphs[i]
        text = paragraph.get("visible_text", "")
        if text:
            item = {"paragraph_id": paragraph["id"], "text": text[:1200]}
            if direction < 0:
                out.insert(0, item)
            else:
                out.append(item)
        i += direction
    return out


def prepare(args: argparse.Namespace) -> int:
    source_path = resolved(args.input)
    raw_workspace = args.workspace.expanduser()
    if args.force and raw_workspace.is_symlink():
        raise FormatterError(f"refusing --force through symbolic-link workspace path: {raw_workspace}")
    workspace = raw_workspace.resolve()
    if not source_path.is_file():
        raise FormatterError(f"source HTML does not exist: {source_path}")
    if source_path == workspace:
        raise FormatterError("workspace must differ from source")
    source_bytes = source_path.read_bytes()
    source = source_bytes.decode("utf-8-sig")
    source_manifest_path = source_path.parent / "source_manifest.json"
    provenance = None
    if source_manifest_path.is_file():
        try:
            provenance = json.loads(source_manifest_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise FormatterError("source_manifest.json is invalid JSON; reacquire or normalize again") from exc
        if not isinstance(provenance, dict) or not isinstance(provenance.get("selected"), dict):
            raise FormatterError("source_manifest.json lacks selected source provenance; reacquire or normalize again")
        selected = provenance["selected"]
        expected_working_hash = selected.get("working_source_sha256")
        if not isinstance(expected_working_hash, str) or not expected_working_hash:
            raise FormatterError("source_manifest.json lacks working_source_sha256; reacquire or normalize again")
        if expected_working_hash != sha256_bytes(source_bytes):
            raise FormatterError("working_source.html no longer matches acquisition source_manifest.json; reacquire or normalize again")
    preflight = html_checks(source)
    if not preflight["ok"]:
        raise FormatterError("HTML preflight failed: " + summarize_html_check_failures(preflight))
    collector = ParagraphCollector(source)
    collector.feed(source)
    collector.close()
    if collector.errors:
        raise FormatterError("HTML paragraph scan failed: " + "; ".join(collector.errors[:5]))
    if not collector.paragraphs:
        raise FormatterError("HTML contains no explicit <p> blocks; normalize/acquire a structured source first")

    paragraphs = [paragraph_record(source, raw, i, args.lang) for i, raw in enumerate(collector.paragraphs, 1)]
    inline_errors = [f"{p['id']}: {error}" for p in paragraphs for error in p.get("markup_errors", [])]
    if inline_errors:
        raise FormatterError("HTML inline-markup scan failed: " + "; ".join(inline_errors[:8]))
    units = [unit for paragraph in paragraphs for unit in paragraph["units"]]
    if not units:
        raise FormatterError("HTML contains no editable prose paragraphs")

    if workspace.exists() and any(workspace.iterdir()) and not args.force:
        raise FormatterError(f"workspace is not empty: {workspace}; use --force to replace")
    if workspace.exists() and args.force:
        assert_safe_workspace_replace(workspace, source_path)
        shutil.rmtree(workspace)
    decisions_dir = workspace / "decisions"
    packets_dir = workspace / "packets"
    decisions_dir.mkdir(parents=True, exist_ok=True)
    packets_dir.mkdir(parents=True, exist_ok=True)

    packets = packetize(paragraphs, args.batch_chars)
    paragraph_position = {p["id"]: i for i, p in enumerate(paragraphs)}
    packet_ids: list[str] = []
    packet_unit_ids: dict[str, list[str]] = {}
    for packet_index, packet_paragraphs in enumerate(packets, 1):
        packet_id = f"p{packet_index:04d}"
        packet_ids.append(packet_id)
        packet_units = [unit for p in packet_paragraphs for unit in p["units"]]
        packet_unit_ids[packet_id] = [unit["id"] for unit in packet_units]
        first_pos = paragraph_position[packet_paragraphs[0]["id"]]
        last_pos = paragraph_position[packet_paragraphs[-1]["id"]]
        packet = {
            "schema_version": VERSION,
            "skill_version": SKILL_VERSION,
            "architecture": "agent-first-html",
            "packet_id": packet_id,
            "source_file": str(source_path),
            "language": args.lang,
            "required_editable_unit_ids": [unit["id"] for unit in packet_units],
            "context_before": _neighbor_context(paragraphs, first_pos, -1),
            "context_after": _neighbor_context(paragraphs, last_pos, 1),
            "paragraphs": [
                {
                    "id": p["id"],
                    "start_tag": p["start_tag"],
                    "visible_text": p["visible_text"],
                    "visible_chars": p["visible_chars"],
                    "units": p["units"],
                }
                for p in packet_paragraphs
            ],
            "instructions": {
                "agent_is_primary_editor": True,
                "required": "one explicit break_after boolean for every required_editable_unit_id",
                "html_rule": "choose only provided safe source offsets; never return replacement prose or HTML",
            },
        }
        atomic_write(packets_dir / f"{packet_id}.json", json_dump(packet))

    manifest = {
        "schema_version": VERSION,
        "skill_version": SKILL_VERSION,
        "architecture": "agent-first-html",
        "script_semantic_autonomy": False,
        "runtime_dependencies": [],
        "source_file": str(source_path),
        "source_sha256": sha256_bytes(source_bytes),
        "source_decoded_sha256": sha256_text(source),
        "source_visible_payload_sha256": sha256_text(canonical_visible(visible_document_text(source))),
        "source_format": "html",
        "language": args.lang,
        "workspace": str(workspace),
        "packets_dir": str(packets_dir),
        "decisions_dir": str(decisions_dir),
        "packet_ids": packet_ids,
        "packet_unit_ids": packet_unit_ids,
        "paragraphs": paragraphs,
        "editable_units": len(units),
        "protected_paragraphs": sum(1 for p in paragraphs if p["protected"]),
        "source_provenance": provenance,
    }
    atomic_write(workspace / "manifest.json", json_dump(manifest))
    summary = {
        "status": "prepared",
        "manifest": str(workspace / "manifest.json"),
        "packets": len(packet_ids),
        "paragraphs": len(paragraphs),
        "editable_units": len(units),
        "protected_paragraphs": manifest["protected_paragraphs"],
        "runtime_dependencies": [],
    }
    print(json_dump(summary), end="")
    return 0


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise FormatterError(f"could not read JSON {path}: {exc}") from exc


def load_decisions(manifest: dict[str, Any], decisions_dir: Path) -> tuple[dict[str, dict[str, Any]], set[str], list[str]]:
    decisions: dict[str, dict[str, Any]] = {}
    reviewed: set[str] = set()
    errors: list[str] = []
    expected_packets = set(manifest["packet_ids"])
    packet_units_map = manifest.get("packet_unit_ids")
    if not isinstance(packet_units_map, dict) or not expected_packets.issubset(set(packet_units_map)):
        errors.append("manifest lacks required packet_unit_ids binding; run prepare again before rendering")
        packet_units_map = {}
    for packet_id in manifest["packet_ids"]:
        path = decisions_dir / f"{packet_id}.json"
        if not path.is_file():
            continue
        data = load_json(path)
        if not isinstance(data, dict):
            errors.append(f"{path.name}: decision file must contain a JSON object")
            continue
        if data.get("schema_version") != VERSION or data.get("packet_id") != packet_id:
            errors.append(f"{path.name}: schema_version/packet_id mismatch")
            continue
        if data.get("reviewed") is True:
            reviewed.add(packet_id)
        decision_list = data.get("decisions", [])
        if not isinstance(decision_list, list):
            errors.append(f"{path.name}: decisions must be a JSON array")
            continue
        allowed_unit_ids = set(packet_units_map.get(packet_id, []))
        for decision in decision_list:
            if not isinstance(decision, dict):
                errors.append(f"{path.name}: each decision must be a JSON object")
                continue
            unit_id = decision.get("unit_id")
            if not unit_id:
                errors.append(f"{path.name}: decision missing unit_id")
                continue
            if unit_id in decisions:
                errors.append(f"duplicate decision for {unit_id}")
                continue
            if allowed_unit_ids and unit_id not in allowed_unit_ids:
                errors.append(f"{path.name}: {unit_id} does not belong to packet {packet_id}")
                continue
            if not isinstance(decision.get("break_after"), bool):
                errors.append(f"{unit_id}: break_after must be an explicit boolean")
            for optional_bool in ("break_before", "standalone"):
                if optional_bool in decision and not isinstance(decision.get(optional_bool), bool):
                    errors.append(f"{unit_id}: {optional_bool} must be a boolean when present")
            importance = decision.get("importance", "normal")
            if importance not in textfmt.IMPORTANCE_VALUES:
                errors.append(f"{unit_id}: invalid importance {importance}")
            offsets = decision.get("split_after_offsets", [])
            if offsets is None:
                offsets = []
            if not isinstance(offsets, list) or any(not isinstance(v, int) for v in offsets):
                errors.append(f"{unit_id}: split_after_offsets must be an integer list")
            decisions[unit_id] = decision
    unexpected = [path.stem for path in decisions_dir.glob("*.json") if path.stem not in expected_packets]
    if unexpected:
        errors.append("unexpected decision packet files: " + ", ".join(sorted(unexpected)))
    return decisions, reviewed, errors


def continuation_start_tag(start_tag: str) -> str:
    # Duplicate semantic/class attributes for a split continuation, but never
    # duplicate document identifiers or legacy named anchors.
    stripped = ID_ATTR_RE.sub("", start_tag)
    stripped = NAME_ATTR_RE.sub("", stripped)
    return stripped


def extract_publishable_fragment(source: str) -> str:
    """Return the first <main> inner HTML, falling back to <body>.

    This fragment is convenient for a Supabase `content_html` column while
    the full `.html` document remains the Cloudflare/static-file artifact.
    """
    main_match = re.search(r"<main\b[^>]*>(?P<body>.*?)</main\s*>", source, re.I | re.S)
    if main_match:
        return main_match.group("body").strip() + "\n"
    body_match = re.search(r"<body\b[^>]*>(?P<body>.*?)</body\s*>", source, re.I | re.S)
    if body_match:
        return body_match.group("body").strip() + "\n"
    raise FormatterError("could not extract a publishable <main>/<body> HTML fragment")


def inject_mobile_css(source: str) -> tuple[str, bool]:
    if 'id="format-books-mobile-v4"' in source or "id='download-reformat-books-mobile-v4'" in source:
        return source, False
    match = re.search(r"</head\s*>", source, re.I)
    if match:
        return source[:match.start()] + MOBILE_CSS + source[match.start():], True
    # HTML fragment / malformed source fallback.
    return MOBILE_CSS + source, True


def apply_insertions(source: str, insertions: dict[int, str]) -> str:
    parts: list[str] = []
    cursor = 0
    for offset in sorted(insertions):
        if offset < cursor or offset > len(source):
            raise FormatterError(f"invalid insertion offset {offset}")
        parts.append(source[cursor:offset])
        parts.append(insertions[offset])
        cursor = offset
    parts.append(source[cursor:])
    return "".join(parts)


class SecurityScanner(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.active_tags: list[str] = []
        self.event_handlers: list[str] = []
        self.javascript_urls: list[str] = []
        self.dangerous_urls: list[str] = []
        self.meta_refresh: list[str] = []
        self.ids: list[str] = []
        self.html_start_count = 0
        self.html_end_count = 0
        self.body_start_count = 0
        self.body_end_count = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if tag == "html":
            self.html_start_count += 1
        elif tag == "body":
            self.body_start_count += 1
        if tag in ACTIVE_TAGS:
            self.active_tags.append(tag)
        attr_map = {key.lower(): (value or "") for key, value in attrs}
        if tag == "meta" and attr_map.get("http-equiv", "").strip().lower() == "refresh":
            self.meta_refresh.append(attr_map.get("content", "")[:160])
        for key, value in attrs:
            key_lower = key.lower()
            value = value or ""
            if key_lower.startswith("on"):
                self.event_handlers.append(key_lower)
            if key_lower in {"href", "src", "action", "formaction", "poster", "xlink:href"}:
                decoded = html.unescape(value)
                compact = re.sub(r"[\x00-\x20]+", "", decoded).lower()
                if compact.startswith("javascript:"):
                    self.javascript_urls.append(value[:120])
                if compact.startswith(("vbscript:", "data:text/html", "data:application/xhtml+xml", "data:image/svg+xml")):
                    self.dangerous_urls.append(value[:120])
            if key_lower == "style":
                compact_style = re.sub(r"[\x00-\x20]+", "", html.unescape(value)).lower()
                if "javascript:" in compact_style or "vbscript:" in compact_style:
                    self.dangerous_urls.append("style:" + value[:110])
            if key_lower in {"id", "xml:id"} and value:
                self.ids.append(value)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag == "html":
            self.html_end_count += 1
        elif tag == "body":
            self.body_end_count += 1

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)


def html_checks(source: str) -> dict[str, Any]:
    paragraphs = ParagraphCollector(source)
    paragraphs.feed(source)
    paragraphs.close()
    security = SecurityScanner()
    security.feed(source)
    security.close()
    id_counts = Counter(security.ids)
    duplicate_ids = sorted(ident for ident, count in id_counts.items() if count > 1)
    inline_markup_errors: list[str] = []
    for index, paragraph in enumerate(paragraphs.paragraphs, 1):
        inner = source[int(paragraph["content_start"]):int(paragraph["content_end"])]
        for error in visible_map(inner)["markup_errors"]:
            inline_markup_errors.append(f"hp{index:06d}: {error}")
    document_structure_errors: list[str] = []
    if security.html_start_count != 1 or security.html_end_count != 1:
        document_structure_errors.append("formal source must contain exactly one <html>...</html>")
    if security.body_start_count != 1 or security.body_end_count != 1:
        document_structure_errors.append("formal source must contain exactly one <body>...</body>")
    unsafe = bool(
        security.active_tags or security.event_handlers or security.javascript_urls
        or security.dangerous_urls or security.meta_refresh
    )
    return {
        "ok": not paragraphs.errors and not inline_markup_errors and not document_structure_errors and not duplicate_ids and not unsafe,
        "paragraph_scan_errors": paragraphs.errors,
        "inline_markup_errors": inline_markup_errors,
        "document_structure_errors": document_structure_errors,
        "paragraph_count": len(paragraphs.paragraphs),
        "duplicate_ids": duplicate_ids,
        "security": {
            "ok": not unsafe,
            "active_tags": sorted(set(security.active_tags)),
            "event_handler_attributes": sorted(set(security.event_handlers)),
            "javascript_urls": security.javascript_urls,
            "dangerous_urls": security.dangerous_urls,
            "meta_refresh": security.meta_refresh,
        },
    }


def summarize_html_check_failures(checks: dict[str, Any]) -> str:
    details: list[str] = []
    if checks.get("document_structure_errors"):
        details.append("document structure")
    if checks.get("paragraph_scan_errors"):
        details.append("paragraph structure")
    if checks.get("inline_markup_errors"):
        details.append("inline markup nesting")
    if checks.get("duplicate_ids"):
        details.append("duplicate IDs")
    if not checks.get("security", {}).get("ok", True):
        details.append("active/unsafe HTML content")
    return ", ".join(details) or "unknown HTML validation error"


def _expected_source_asset_inventory(manifest: dict[str, Any]) -> list[dict[str, Any]] | None:
    provenance = manifest.get("source_provenance")
    if not isinstance(provenance, dict):
        return None
    selected = provenance.get("selected")
    if not isinstance(selected, dict):
        return None
    items = selected.get("asset_files")
    return items if isinstance(items, list) else None


def _publication_asset_source(manifest: dict[str, Any]) -> Path | None:
    provenance = manifest.get("source_provenance")
    if not isinstance(provenance, dict):
        return None
    selected = provenance.get("selected")
    if not isinstance(selected, dict):
        return None
    assets_value = selected.get("assets_dir")
    asset_files = selected.get("asset_files")
    if not assets_value:
        if isinstance(asset_files, list) and asset_files:
            raise FormatterError("source provenance lists assets but has no assets_dir; reacquire or normalize again")
        return None
    path = Path(str(assets_value))
    if not path.is_dir():
        raise FormatterError("source asset directory declared by provenance is missing; reacquire or normalize again")
    return path


def _normalize_fragment_asset_prefix(value: str | None) -> str | None:
    if value is None:
        return None
    prefix = str(value).strip()
    if not prefix:
        return None
    if any(ch in prefix for ch in {chr(34), chr(39), '<', '>', '`'}) or any(ord(ch) < 32 for ch in prefix):
        raise FormatterError("fragment asset prefix contains unsafe characters")
    decoded = html.unescape(prefix)
    compact = re.sub(r"[\x00-\x20]+", "", decoded).lower()
    if compact.startswith(("javascript:", "vbscript:", "data:")):
        raise FormatterError("fragment asset prefix uses an unsafe URL scheme")
    parsed = urllib.parse.urlparse(prefix)
    if parsed.scheme:
        if parsed.scheme.lower() not in {"http", "https"} or not parsed.netloc:
            raise FormatterError("fragment asset prefix must use http(s) when an absolute URL is supplied")
    else:
        if not prefix.startswith("/") or prefix.startswith("//"):
            raise FormatterError("fragment asset prefix must be a site-root path or an http(s) URL")
        if ".." in Path(parsed.path).parts:
            raise FormatterError("fragment asset prefix must not contain parent-directory segments")
    if not prefix.endswith("/"):
        prefix += "/"
    return prefix


def _asset_inventory(root: Path) -> list[dict[str, Any]]:
    if root.is_symlink():
        raise FormatterError(f"asset directory must not be a symbolic link: {root}")
    files: list[dict[str, Any]] = []
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            raise FormatterError(f"asset directory contains a symbolic link: {path}")
        if not path.is_file():
            continue
        data = path.read_bytes()
        files.append({
            "relative_path": path.relative_to(root).as_posix(),
            "sha256": sha256_bytes(data),
            "bytes": len(data),
        })
    return files


def _rewrite_asset_prefix(source: str, old_prefix: str, new_prefix: str) -> str:
    attr_re = re.compile(r"(?P<prefix>\b(?:href|src|poster|xlink:href)\s*=\s*)(?P<quote>[\"'])(?P<url>.*?)(?P=quote)", re.I)
    def replace(match: re.Match[str]) -> str:
        value = match.group("url")
        if not value.startswith(old_prefix):
            return match.group(0)
        return f"{match.group('prefix')}{match.group('quote')}{new_prefix}{value[len(old_prefix):]}{match.group('quote')}"
    return attr_re.sub(replace, source)


def render(args: argparse.Namespace) -> int:
    manifest_path = resolved(args.manifest)
    manifest = load_json(manifest_path)
    if manifest.get("schema_version") != VERSION or manifest.get("architecture") != "agent-first-html":
        raise FormatterError("manifest is not a v4 Agent-first HTML manifest")
    source_path = Path(manifest["source_file"])
    source_bytes = source_path.read_bytes()
    if sha256_bytes(source_bytes) != manifest["source_sha256"]:
        raise FormatterError("source file changed after prepare")
    source = source_bytes.decode("utf-8-sig")
    decisions_dir = resolved(args.decisions_dir) if args.decisions_dir else Path(manifest["decisions_dir"])
    output_path = resolved(args.output)
    report_path = resolved(args.report)
    fragment_path = resolved(args.fragment_output) if args.fragment_output else None
    publication_manifest_path = resolved(args.publication_manifest) if args.publication_manifest else None
    protected_paths = [output_path, report_path] + [p for p in (fragment_path, publication_manifest_path) if p is not None]
    if len(set(protected_paths)) != len(protected_paths):
        raise FormatterError("output, report, fragment, and publication-manifest paths must all be distinct")
    for path in protected_paths:
        if path == source_path.resolve() or path == manifest_path:
            raise FormatterError("output/report/fragment/publication manifest must not overwrite source or manifest")

    decisions, reviewed, decision_errors = load_decisions(manifest, decisions_dir)
    if decision_errors:
        raise FormatterError("; ".join(decision_errors))
    all_units = {unit["id"]: unit for p in manifest["paragraphs"] for unit in p["units"]}
    required = set(all_units)
    missing = sorted(required - set(decisions))
    unreviewed = sorted(set(manifest["packet_ids"]) - reviewed)
    if (missing or unreviewed) and not args.allow_unreviewed:
        pieces = []
        if missing:
            pieces.append(f"{len(missing)} editable units without explicit Agent decisions")
        if unreviewed:
            pieces.append(f"{len(unreviewed)} packets not explicitly reviewed")
        raise FormatterError("; ".join(pieces))

    insertions: dict[int, str] = {}
    selected_splits: list[dict[str, Any]] = []
    pivotal: list[str] = []
    paragraph_lengths: list[int] = []
    soft_overages = 0
    unsafe_requested_boundaries: list[str] = []

    mobile_sentence_breaks = 0
    mobile_clause_breaks = 0
    hard_semantic_splits = 0
    unsafe_clause_breaks = 0
    soft_break_inside_abbreviation = 0
    sentence_break_after_abbr = 0
    sentence_break_before_punctuation = 0
    sentence_break_before_lowercase_dialogue_tag = 0
    soft_break_splits_word = 0
    source_paragraph_count = len(manifest["paragraphs"])
    source_paragraph_boundaries_preserved = 0

    for paragraph in manifest["paragraphs"]:
        units = paragraph["units"]
        if not units:
            continue
        paragraph_split_offsets_with_kind: dict[int, str] = {}
        paragraph_visible_offsets: set[int] = set()
        # The source </p> is always a hard boundary. Agent break_after=false on
        # the last sentence never merges across original source paragraphs.
        for i, unit in enumerate(units):
            decision = decisions.get(unit["id"], {"break_after": False})
            importance = decision.get("importance", "normal")
            standalone = bool(decision.get("standalone")) or importance in textfmt.MANDATORY_STANDALONE
            if importance in textfmt.MANDATORY_STANDALONE:
                pivotal.append(unit["id"])
            wants_before = bool(decision.get("break_before")) or standalone
            wants_after = bool(decision.get("break_after")) or standalone

            if wants_before and i > 0:
                previous = units[i - 1]
                offset = previous.get("break_after_source_offset")
                if offset is None:
                    unsafe_requested_boundaries.append(f"before {unit['id']}")
                elif offset < paragraph["content_end"]:
                    paragraph_split_offsets_with_kind[int(offset)] = "sentence"
                    paragraph_visible_offsets.add(int(previous["visible_end"]))
            if wants_after and i < len(units) - 1:
                offset = unit.get("break_after_source_offset")
                if offset is None:
                    unsafe_requested_boundaries.append(f"after {unit['id']}")
                elif offset < paragraph["content_end"]:
                    paragraph_split_offsets_with_kind[int(offset)] = "sentence"
                    paragraph_visible_offsets.add(int(unit["visible_end"]))

            allowed = {int(candidate["source_offset"]): candidate for candidate in unit.get("split_candidates", [])}
            for offset in sorted(set(decision.get("split_after_offsets") or [])):
                if int(offset) not in allowed:
                    raise FormatterError(f"{unit['id']}: selected split offset {offset} is not a safe supplied candidate")
                candidate = allowed[int(offset)]
                punct = str(candidate.get("punctuation", ""))
                b_kind = "sentence" if punct in (".", "!", "?", "...") else "clause"
                paragraph_split_offsets_with_kind[int(offset)] = b_kind
                paragraph_visible_offsets.add(int(candidate["visible_offset"]))
                selected_splits.append({
                    "unit_id": unit["id"],
                    "paragraph_id": paragraph["id"],
                    "source_offset": int(offset),
                    "visible_offset": int(candidate["visible_offset"]),
                    "source": candidate["source"],
                    "punctuation": punct,
                })

        # v4.3.0 Semantic Paragraph + Visual Soft-Break Architecture:
        # Source <p> tags are 100% preserved as <p class="source-paragraph">.
        # Intra-paragraph breakpoints create <span class="mobile-soft-break sentence|clause" aria-hidden="true"></span>
        # instead of creating fake hard </p><p> tags that violate author paragraph semantics.
        for offset, break_kind in paragraph_split_offsets_with_kind.items():
            if not (paragraph["content_start"] < offset < paragraph["content_end"]):
                raise FormatterError(f"paragraph split offset outside content: {paragraph['id']} @ {offset}")
            b_type = "sentence" if break_kind == "sentence" else "clause"
            soft_insertion = f'<span class="mobile-soft-break {b_type}" aria-hidden="true"></span>'
            if offset in insertions and insertions[offset] != soft_insertion:
                raise FormatterError(f"conflicting insertion at source offset {offset}")
            insertions[offset] = soft_insertion

        # QA metrics tracking
        source_paragraph_boundaries_preserved += 1
        if paragraph_split_offsets_with_kind:
            for offset, b_kind in paragraph_split_offsets_with_kind.items():
                if b_kind == "sentence":
                    mobile_sentence_breaks += 1
                    # Hard gate: check if it splits after abbreviation
                    prefix_html = source[max(0, offset-30):offset].strip()
                    if prefix_html.endswith("</abbr>"):
                        soft_break_inside_abbreviation += 1

                    # Also check raw text for abbreviation

                    inner_html = source[paragraph["content_start"]:paragraph["content_end"]]
                    mapping = visible_map(inner_html)
                    # find visible offset
                    raw_target = offset - paragraph["content_start"]
                    vis_idx = -1
                    for i, (start, end) in enumerate(zip(mapping["raw_start_by_char"], mapping["raw_end_by_char"])):
                        if start <= raw_target <= end:
                            vis_idx = i
                            break
                    if vis_idx >= 0:
                        true_visible = mapping["text"]
                        if textfmt._is_invalid_sentence_boundary(true_visible, vis_idx - 1, vis_idx):
                            sentence_break_after_abbr += 1
                else:
                    mobile_clause_breaks += 1

        # QA uses source-visible offsets stored on units/candidates. Extract the
        # paragraph's true visible text again to keep char counts faithful.
        source_inner = source[paragraph["content_start"]:paragraph["content_end"]]
        mapping = visible_map(source_inner)
        true_visible = mapping["text"]
        boundaries = sorted(v for v in paragraph_visible_offsets if 0 < v < len(true_visible))
        cursor = 0
        for boundary in boundaries + [len(true_visible)]:
            segment = true_visible[cursor:boundary]
            length = textfmt.visible_length(segment)
            if length:
                paragraph_lengths.append(length)
                if length > args.soft_max_chars:
                    soft_overages += 1
            cursor = boundary

    if unsafe_requested_boundaries:
        raise FormatterError("Agent requested boundaries that are unsafe inside active inline markup: " + ", ".join(unsafe_requested_boundaries[:12]))

    hard_over = [length for length in paragraph_lengths if length > args.hard_max_chars]
    if hard_over:
        raise FormatterError(f"{len(hard_over)} Agent-rendered prose paragraphs exceed hard max; revise decisions")

    output = apply_insertions(source, insertions)
    css_injected = False
    if not args.no_mobile_css:
        output, css_injected = inject_mobile_css(output)

    published_assets_dir: Path | None = None
    published_asset_files: list[dict[str, Any]] = []
    source_assets = _publication_asset_source(manifest)
    if source_assets is not None:
        # Inventory first so symlinks cannot be silently dereferenced outside
        # the acquisition tree during publication.
        current_source_assets = _asset_inventory(source_assets)
        expected_source_assets = _expected_source_asset_inventory(manifest)
        if expected_source_assets is not None and current_source_assets != expected_source_assets:
            raise FormatterError("source asset directory changed after acquisition/normalization; reacquire or normalize again")
        published_assets_dir = output_path.parent / f"{output_path.stem}.assets"
        if published_assets_dir.exists():
            if not published_assets_dir.is_dir():
                raise FormatterError(f"publication asset destination exists and is not a directory: {published_assets_dir}")
            existing_assets = _asset_inventory(published_assets_dir)
            if existing_assets != current_source_assets:
                raise FormatterError(
                    f"publication asset destination already exists with different contents: {published_assets_dir}; "
                    "remove/relocate it explicitly or choose another output name"
                )
            published_asset_files = existing_assets
        else:
            shutil.copytree(source_assets, published_assets_dir)
            published_asset_files = _asset_inventory(published_assets_dir)
        output = _rewrite_asset_prefix(output, "assets/", f"{published_assets_dir.name}/")

    source_payload = canonical_visible(visible_document_text(source))
    output_payload = canonical_visible(visible_document_text(output))
    integrity = source_payload == output_payload
    if not integrity:
        raise FormatterError("visible-text payload integrity failed; output was not written")
    checks = html_checks(output)
    if not checks["ok"]:
        raise FormatterError("HTML formal checks failed: " + summarize_html_check_failures(checks))

    missing_preview = missing if args.allow_unreviewed else []
    unreviewed_preview = unreviewed if args.allow_unreviewed else []
    formal = not missing_preview and not unreviewed_preview and integrity and checks["ok"] and not hard_over
    lengths_sorted = sorted(paragraph_lengths)
    warnings: list[str] = []
    if missing_preview or unreviewed_preview:
        warnings.append("preview only: Agent review/decision coverage is incomplete")
    if soft_overages > max(3, len(paragraph_lengths) // 5):
        warnings.append("many prose paragraphs exceed the soft mobile target; Agent should inspect rhythm")

    fragment = None
    fragment_asset_prefix = _normalize_fragment_asset_prefix(getattr(args, "fragment_asset_prefix", None))
    if fragment_path is not None:
        fragment = extract_publishable_fragment(output)
        if published_assets_dir is not None and fragment_asset_prefix:
            fragment = _rewrite_asset_prefix(fragment, f"{published_assets_dir.name}/", fragment_asset_prefix)
        fragment_checks = html_checks(f"<html><body>{fragment}</body></html>")
        if not fragment_checks["security"]["ok"]:
            raise FormatterError("publishable HTML fragment failed security scan")
        atomic_write(fragment_path, fragment)

    fragment_assets_require_mapping = bool(fragment is not None and published_assets_dir is not None and not fragment_asset_prefix)
    supabase_fragment_ready = bool(formal and fragment is not None and not fragment_assets_require_mapping)
    if fragment_assets_require_mapping:
        warnings.append(
            "content_html contains relative book-asset URLs; map the sibling assets directory at the same route or rerender with --fragment-asset-prefix before database publication"
        )

    report = {
        "schema_version": VERSION,
        "skill_version": SKILL_VERSION,
        "architecture": "agent-first-html",
        "script_semantic_autonomy": False,
        "runtime_dependencies": [],
        "formal_release": formal,
        "source_file": str(source_path),
        "manifest_file": str(manifest_path),
        "output_file": str(output_path),
        "final_format": "html",
        "content_type": "text/html; charset=utf-8",
        "source_sha256": manifest["source_sha256"],
        "output_sha256": sha256_text(output),
        "source_visible_payload_sha256": sha256_text(source_payload),
        "output_visible_payload_sha256": sha256_text(output_payload),
        "content_integrity": integrity,
        "html_checks": checks,
        "mobile_css_injected": css_injected,
        "agent_decisions": len(decisions),
        "editable_units": len(required),
        "missing_agent_decision_units": missing_preview,
        "source_paragraph_count": source_paragraph_count,
        "source_paragraph_boundaries_preserved": source_paragraph_boundaries_preserved,
        "mobile_sentence_breaks": mobile_sentence_breaks,
        "mobile_clause_breaks": mobile_clause_breaks,
        "hard_semantic_splits": hard_semantic_splits,
        "unsafe_clause_breaks": unsafe_clause_breaks,
        "soft_break_inside_abbreviation": soft_break_inside_abbreviation,
        "sentence_break_after_abbr": sentence_break_after_abbr,
        "sentence_break_before_punctuation": sentence_break_before_punctuation,
        "sentence_break_before_lowercase_dialogue_tag": sentence_break_before_lowercase_dialogue_tag,
        "soft_break_splits_word": soft_break_splits_word,
        "reviewed_packets": len(reviewed),
        "total_packets": len(manifest["packet_ids"]),
        "unreviewed_packets": unreviewed_preview,
        "agent_selected_internal_splits": selected_splits,
        "pivotal_units": pivotal,
        "inserted_paragraph_boundaries": len(insertions),
        "settings": {"soft_max_chars": args.soft_max_chars, "hard_max_chars": args.hard_max_chars},
        "prose_paragraphs": len(paragraph_lengths),
        "prose_min_chars": min(paragraph_lengths) if paragraph_lengths else 0,
        "prose_median_chars": statistics.median(paragraph_lengths) if paragraph_lengths else 0,
        "prose_mean_chars": round(statistics.mean(paragraph_lengths), 1) if paragraph_lengths else 0,
        "prose_p95_chars": lengths_sorted[int(0.95 * (len(lengths_sorted) - 1))] if lengths_sorted else 0,
        "prose_max_chars": max(paragraph_lengths) if paragraph_lengths else 0,
        "prose_over_soft_max": soft_overages,
        "prose_over_hard_max": len(hard_over),
        "source_provenance": manifest.get("source_provenance"),
        "publishing": {
            "cloudflare_static_asset_ready": formal,
            "supabase_database_content_html_ready": supabase_fragment_ready,
            "storage_direct_html_serving_recommended": False,
            "fragment_file": str(fragment_path) if fragment_path else None,
            "fragment_sha256": sha256_text(fragment) if fragment is not None else None,
            "assets_dir": str(published_assets_dir) if published_assets_dir else None,
            "asset_files": published_asset_files,
            "fragment_asset_prefix": fragment_asset_prefix,
            "fragment_assets_require_site_mapping": fragment_assets_require_mapping,
        },
        "warnings": warnings,
    }
    publication_text: str | None = None
    if publication_manifest_path is not None:
        publication = {
            "schema_version": VERSION,
            "skill_version": SKILL_VERSION,
            "title": ((manifest.get("source_provenance") or {}).get("title") if isinstance(manifest.get("source_provenance"), dict) else None),
            "author": ((manifest.get("source_provenance") or {}).get("author") if isinstance(manifest.get("source_provenance"), dict) else None),
            "language": manifest.get("language"),
            "full_html_file": str(output_path),
            "full_html_sha256": report["output_sha256"],
            "content_html_file": str(fragment_path) if fragment_path else None,
            "content_html_sha256": report["publishing"]["fragment_sha256"],
            "content_type": "text/html; charset=utf-8",
            "formal_release": formal,
            "html_security_ok": checks["security"]["ok"],
            "assets_dir": str(published_assets_dir) if published_assets_dir else None,
            "asset_files": published_asset_files,
            "fragment_asset_prefix": fragment_asset_prefix,
            "fragment_assets_require_site_mapping": fragment_assets_require_mapping,
            "supabase_database_content_html_ready": supabase_fragment_ready,
            "source_provenance": manifest.get("source_provenance"),
        }
        publication_text = json_dump(publication)
        report["publishing"]["publication_manifest_file"] = str(publication_manifest_path)
        report["publishing"]["publication_manifest_sha256"] = sha256_text(publication_text)

    atomic_write(output_path, output)
    if publication_manifest_path is not None and publication_text is not None:
        atomic_write(publication_manifest_path, publication_text)
    atomic_write(report_path, json_dump(report))
    print(json_dump(report), end="")
    return 0


def audit(args: argparse.Namespace) -> int:
    report = load_json(resolved(args.report))
    failures: list[str] = []
    source_path = Path(report["source_file"])
    output_path = Path(report["output_file"])
    if not source_path.is_file() or sha256_bytes(source_path.read_bytes()) != report["source_sha256"]:
        failures.append("source file is missing or changed after render")
    if not output_path.is_file() or sha256_bytes(output_path.read_bytes()) != report["output_sha256"]:
        failures.append("output file is missing or changed after render")
    if not report.get("content_integrity"):
        failures.append("visible-text payload integrity is not confirmed")
    if not report.get("html_checks", {}).get("ok"):
        failures.append("HTML structure/security checks failed")
    if report.get("prose_over_hard_max"):
        failures.append("one or more prose paragraphs exceed hard maximum")
    if report.get("missing_agent_decision_units"):
        failures.append("editable units lack explicit Agent decisions")
    if report.get("hard_semantic_splits", 0) > 0:
        failures.append("hard_semantic_splits > 0: do not break original paragraphs")
    if report.get("soft_break_inside_abbreviation", 0) > 0:
        failures.append("soft_break_inside_abbreviation > 0")
    if report.get("sentence_break_after_abbr", 0) > 0:
        failures.append("sentence_break_after_abbr > 0")
    if report.get("sentence_break_before_punctuation", 0) > 0:
        failures.append("sentence_break_before_punctuation > 0")
    if report.get("sentence_break_before_lowercase_dialogue_tag", 0) > 0:
        failures.append("sentence_break_before_lowercase_dialogue_tag > 0")
    if report.get("soft_break_splits_word", 0) > 0:
        failures.append("soft_break_splits_word > 0")
    fragment_file = report.get("publishing", {}).get("fragment_file")
    fragment_hash = report.get("publishing", {}).get("fragment_sha256")
    if fragment_file and fragment_hash:
        fragment_path = Path(fragment_file)
        if not fragment_path.is_file() or sha256_bytes(fragment_path.read_bytes()) != fragment_hash:
            failures.append("published content_html fragment is missing or changed after render")
    assets_dir_value = report.get("publishing", {}).get("assets_dir")
    asset_files = report.get("publishing", {}).get("asset_files") or []
    if assets_dir_value:
        assets_dir = Path(assets_dir_value)
        if not assets_dir.is_dir():
            failures.append("published asset directory is missing")
        else:
            for item in asset_files:
                if not isinstance(item, dict) or not item.get("relative_path") or not item.get("sha256"):
                    failures.append("published asset inventory is invalid")
                    break
                relative = Path(str(item["relative_path"]))
                if relative.is_absolute() or ".." in relative.parts:
                    failures.append("published asset inventory contains an unsafe path")
                    break
                asset_path = assets_dir / relative
                if not asset_path.is_file() or sha256_bytes(asset_path.read_bytes()) != item["sha256"]:
                    failures.append(f"published asset is missing or changed: {item['relative_path']}")
            try:
                current_inventory = _asset_inventory(assets_dir)
            except FormatterError as exc:
                failures.append(f"published asset directory failed safety inventory: {exc}")
            else:
                expected_paths = {str(item.get("relative_path")) for item in asset_files if isinstance(item, dict)}
                current_paths = {str(item.get("relative_path")) for item in current_inventory}
                unexpected = sorted(current_paths - expected_paths)
                if unexpected:
                    failures.append("published asset directory contains untracked files: " + ", ".join(unexpected[:12]))
    publication_file = report.get("publishing", {}).get("publication_manifest_file")
    publication_hash = report.get("publishing", {}).get("publication_manifest_sha256")
    if publication_file and publication_hash:
        publication_path = Path(publication_file)
        if not publication_path.is_file() or sha256_bytes(publication_path.read_bytes()) != publication_hash:
            failures.append("publication manifest is missing or changed after render")
    if args.require_formal and not report.get("formal_release"):
        failures.append("report is not a fully Agent-reviewed formal release")
    result = {
        "passed": not failures,
        "formal_release": report.get("formal_release", False),
        "final_format": report.get("final_format"),
        "failures": failures,
        "warnings": report.get("warnings", []),
    }
    print(json_dump(result), end="")
    return 0 if not failures else 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Agent-first HTML-native mobile formatter")
    sub = parser.add_subparsers(dest="command", required=True)

    prep = sub.add_parser("prepare", help="create Agent review packets from explicit HTML <p> blocks")
    prep.add_argument("input", type=Path)
    prep.add_argument("--workspace", type=Path, required=True)
    prep.add_argument("--lang", choices=["en", "sw"], default="en")
    prep.add_argument("--batch-chars", type=int, default=12000)
    prep.add_argument("--force", action="store_true")
    prep.set_defaults(func=prepare)

    rend = sub.add_parser("render", help="apply Agent decisions directly to HTML and run QA")
    rend.add_argument("--manifest", type=Path, required=True)
    rend.add_argument("--decisions-dir", type=Path)
    rend.add_argument("--output", type=Path, required=True)
    rend.add_argument("--report", type=Path, required=True)
    rend.add_argument("--soft-max-chars", type=int, default=300)
    rend.add_argument("--hard-max-chars", type=int, default=420)
    rend.add_argument("--allow-unreviewed", action="store_true")
    rend.add_argument("--no-mobile-css", action="store_true")
    rend.add_argument("--fragment-output", type=Path, help="optional <main>/<body> HTML fragment for a Supabase content_html column")
    rend.add_argument("--fragment-asset-prefix", help="optional site path/URL prefix for book assets inside the database HTML fragment, e.g. /book-assets/treasure-island/")
    rend.add_argument("--publication-manifest", type=Path, help="optional JSON handoff manifest for publishing")
    rend.set_defaults(func=render)

    aud = sub.add_parser("audit", help="verify final HTML/source/report integrity")
    aud.add_argument("--report", type=Path, required=True)
    aud.add_argument("--require-formal", action="store_true")
    aud.set_defaults(func=audit)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    if hasattr(args, "batch_chars") and args.batch_chars < 1000:
        parser.error("--batch-chars must be at least 1000")
    if hasattr(args, "soft_max_chars"):
        if args.soft_max_chars <= 0 or args.hard_max_chars <= 0:
            parser.error("--soft-max-chars and --hard-max-chars must be positive")
    try:
        return args.func(args)
    except (FormatterError, OSError, UnicodeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
