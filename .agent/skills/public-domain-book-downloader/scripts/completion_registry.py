#!/usr/bin/env python3
"""Minimal read-only completion catalog helper for public-domain-book-downloader.

The downloader can use a local copy of classics_catalog.json to avoid downloading
books that are already completed. This standalone helper intentionally does not
modify Google Drive or append publishing records.
"""
from __future__ import annotations

import html
import json
import re
import unicodedata
from pathlib import Path
from typing import Any

SKILL_VERSION = "1.0.0"
REGISTRY_FILE_ID = "1Bal3bdZMCtXJma6q6Z--zNFvJPC2oeV-"
REGISTRY_URL = f"https://drive.google.com/file/d/{REGISTRY_FILE_ID}/view?usp=share_link"

class RegistryError(RuntimeError):
    pass


def normalize_text(value: str) -> str:
    value = html.unescape(value or "")
    value = unicodedata.normalize("NFKC", value).casefold()
    value = value.replace("’", "'").replace("‘", "'").replace("`", "'")
    value = re.sub(r"[^\w]+", " ", value, flags=re.UNICODE)
    return " ".join(value.split())


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = value.casefold().replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def load_catalog(path: Path) -> list[dict[str, Any]]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise RegistryError(f"cannot read completion catalog {path}: {exc}") from exc
    if not isinstance(data, list):
        raise RegistryError("completion catalog root must be a JSON array")
    for idx, row in enumerate(data):
        if not isinstance(row, dict):
            raise RegistryError(f"catalog item {idx} is not an object")
        for key in ("id", "title", "author"):
            if key not in row:
                raise RegistryError(f"catalog item {idx} is missing required field {key!r}")
    return data


def validate_catalog(catalog: list[dict[str, Any]]) -> dict[str, Any]:
    ids: set[int] = set()
    pairs: set[tuple[str, str]] = set()
    duplicate_ids: list[Any] = []
    duplicate_pairs: list[dict[str, Any]] = []
    invalid_records: list[dict[str, Any]] = []
    for idx, row in enumerate(catalog):
        rid = row.get("id")
        if not isinstance(rid, int) or isinstance(rid, bool) or rid <= 0:
            invalid_records.append({"index": idx, "reason": "id must be a positive integer", "id": rid})
        elif rid in ids:
            duplicate_ids.append(rid)
        else:
            ids.add(rid)
        title = normalize_text(str(row.get("title", "")))
        author = normalize_text(str(row.get("author", "")))
        if not title or not author:
            invalid_records.append({"index": idx, "reason": "title and author must be non-empty"})
        pair = (title, author)
        if pair in pairs:
            duplicate_pairs.append({"index": idx, "title": row.get("title"), "author": row.get("author")})
        else:
            pairs.add(pair)
    return {
        "ok": not duplicate_ids and not duplicate_pairs and not invalid_records,
        "count": len(catalog),
        "duplicate_ids": duplicate_ids,
        "duplicate_title_author": duplicate_pairs,
        "invalid_records": invalid_records,
    }


def check_catalog(catalog: list[dict[str, Any]], title: str, author: str, slug: str | None = None) -> dict[str, Any]:
    wanted_title = normalize_text(title)
    wanted_author = normalize_text(author)
    wanted_slug = slugify(slug or title)
    exact: list[dict[str, Any]] = []
    slug_author: list[dict[str, Any]] = []
    slug_conflicts: list[dict[str, Any]] = []
    for row in catalog:
        row_title = normalize_text(str(row.get("title", "")))
        row_author = normalize_text(str(row.get("author", "")))
        row_slug = slugify(str(row.get("slug") or row.get("title") or ""))
        if row_title == wanted_title and row_author == wanted_author:
            exact.append(row)
        elif row_slug and row_slug == wanted_slug:
            if row_author == wanted_author:
                slug_author.append(row)
            else:
                slug_conflicts.append(row)
    matches = exact or slug_author
    if matches:
        return {"status": "completed", "completed": True, "match": matches[0], "match_method": "title+author" if exact else "slug+author"}
    if slug_conflicts:
        return {"status": "ambiguous", "completed": False, "reason": "same slug/title appears with a different author", "conflicts": slug_conflicts}
    return {"status": "not-completed", "completed": False, "slug": wanted_slug}
