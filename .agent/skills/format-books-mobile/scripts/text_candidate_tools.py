#!/usr/bin/env python3
"""Dependency-free text candidate helpers for download-reformat-books-mobile v4.2.

These functions create addressable sentence and long-sentence split candidates.
They never decide final paragraph layout; the Agent does.
"""
from __future__ import annotations

import re
from typing import Any

WS_RE = re.compile(r"\s+")
CLOSERS = '"”’»)]}'

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

COMMON_ABBREVIATIONS = {
    "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "mt", "rev", "hon", "gen", "col", "maj",
    "capt", "lt", "sgt", "sen", "rep", "gov", "pres", "no", "nos", "fig", "eq", "dept", "est", "approx",
    "etc", "e.g", "i.e", "vs", "cf", "al", "vol", "pp", "p", "ed", "eds", "trans", "a.m", "p.m",
    "bw", "bi", "dk", "mhe", "k.m", "n.k", "n.k.k",
    "m", "mme", "mlle", "chap", "j", "r", "t",
}
# These almost always introduce/modify what follows, so a following capital
# does not by itself turn the dot into a sentence boundary. Contextual
# abbreviations such as `etc.`/`e.g.` are intentionally excluded: a false
# candidate is harmless because the Agent can choose break_after=false, while
# hiding a real sentence boundary removes an Agent choice.
ALWAYS_CONTINUE_ABBREVIATIONS = {
    "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "mt", "rev", "hon",
    "gen", "col", "maj", "capt", "lt", "sgt", "sen", "rep", "gov", "pres",
    "no", "nos", "fig", "eq", "dept", "vol", "pp", "p", "ed", "eds",
    "trans", "vs", "cf", "al", "approx",
}
ATTRIBUTION_WORDS = {
    "he", "she", "they", "i", "we", "you", "it",
    "said", "asked", "replied", "answered", "whispered", "shouted", "cried", "murmured", "added",
    "alisema", "akauliza", "alijibu", "akanong'ona", "akanong’ona", "alipaza", "aliongeza", "akasema",
}


class CandidateError(RuntimeError):
    pass


def canonical(text: str) -> str:
    return WS_RE.sub("", text)


def inline(text: str) -> str:
    return WS_RE.sub(" ", text).strip()


def visible_length(text: str) -> int:
    return len(inline(text))


def word_count(text: str) -> int:
    return len(re.findall(r"\b[\w’'-]+\b", text, re.UNICODE))


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
    return bool(re.fullmatch(r"[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+", token)) and dot_index < right - 1



def _is_invalid_sentence_boundary(text: str, start: int, end: int) -> bool:
    """Returns True if the punctuation at start...end is definitively NOT a sentence boundary."""
    char = text[start]

    next_index, _ = _next_nonspace(text, end)
    next_word = _next_word(text, end)
    lower_next = next_word.lower()

    if char == ".":
        token = _token_before_dot(text, start)
        if token in COMMON_ABBREVIATIONS:
            return True
        prefix = text[max(0, start - 20):start + 1]
        if len(token) == 1 and re.search(r"(?:[A-Za-z]\.)$", prefix):
            return True
        if re.search(r"(?:[A-Za-z]{1,4}\.){2,}$", prefix):
            return True

    if next_index < len(text) and text[next_index] in ",;:—-–":
        return True

    if any(q in text[start:end] for q in CLOSERS) and lower_next in ATTRIBUTION_WORDS:
        return True

    if next_word and next_word[:1].islower():
        return True

    return False


def builtin_boundaries(text: str, lang: str) -> list[int]:
    boundaries: list[int] = []
    i = 0
    while i < len(text):
        char = text[i]
        if char not in ".!?:":
            i += 1
            continue
        # Colons are not ordinary sentence boundaries; only .!? are used.
        if char == ":":
            i += 1
            continue
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

        next_index, _ = _next_nonspace(text, end)
        next_word = _next_word(text, end)
        lower_next = next_word.lower()

        if any(q in text[i + 1:end] for q in CLOSERS) and lower_next in ATTRIBUTION_WORDS:
            i = end
            continue

        if char == "." and punctuation == ".":
            token = _token_before_dot(text, i)
            if token in COMMON_ABBREVIATIONS:
                if token in ALWAYS_CONTINUE_ABBREVIATIONS:
                    i = end
                    continue
                if next_word and next_word[:1].islower():
                    i = end
                    continue
            prefix = text[max(0, i - 20):i + 1]
            if len(token) == 1 and re.search(r"(?:\b[A-Za-z]\.)$", prefix):
                if next_word and (len(next_word) == 1 or next_word[:1].isupper()):
                    i = end
                    continue
            if re.search(r"(?:\b[A-Za-z]{1,4}\.){2,}$", prefix):
                if next_word and next_word[:1].islower():
                    i = end
                    continue

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
        raise CandidateError("sentence segmentation changed non-whitespace source characters")
    return spans


def long_sentence_candidates(text: str, source_start: int = 0) -> list[dict[str, Any]]:
    if visible_length(text) <= 240:
        return []
    candidates: dict[int, dict[str, Any]] = {}
    for match in re.finditer(r"[;:—–,.!?]", text):
        offset = match.end()
        while offset < len(text) and text[offset] in CLOSERS:
            offset += 1
        if offset >= len(text):
            continue

        punct = match.group()
        if punct in (".", "!", "?") and _is_invalid_sentence_boundary(text, match.start(), offset):
            continue
        candidates[offset] = {
            "offset": offset,
            "source_offset": source_start + offset,
            "source": "punctuation",
            "punctuation": match.group(),
            "left_context": inline(text[max(0, offset - 80):offset]),
            "right_context": inline(text[offset:offset + 80]),
        }
    if visible_length(text) > 360:
        last_added = -999
        for match in re.finditer(r"\s+", text):
            offset = match.start()
            if offset <= 0 or offset >= len(text) or offset - last_added < 90:
                continue
            left_len = visible_length(text[max(0, offset - 180):offset])
            right_len = visible_length(text[offset:offset + 180])
            if left_len >= 60 and right_len >= 40:
                candidates.setdefault(offset, {
                    "offset": offset,
                    "source_offset": source_start + offset,
                    "source": "whitespace_fallback",
                    "punctuation": "",
                    "left_context": inline(text[max(0, offset - 80):offset]),
                    "right_context": inline(text[offset:offset + 80]),
                })
                last_added = offset
    return [candidates[key] for key in sorted(candidates)]
