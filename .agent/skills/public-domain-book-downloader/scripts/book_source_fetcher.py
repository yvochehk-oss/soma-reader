#!/usr/bin/env python3
"""Acquire public-domain English books for public-domain-book-downloader.

Priority:
1. Standard Ebooks public Git/XHTML source (best semantic structure)
2. Gutendex metadata -> Project Gutenberg HTML from a mirror
3. Gutenberg UTF-8 plain text from a mirror
4. Deterministic mirror URL fallbacks derived from the Gutenberg ID

Runtime dependency policy: Python standard library only.

The downloader always preserves raw downloads and writes a separate
`working_source.html` for the Agent-first formatter. It never treats the
working derivative as the immutable source artifact.
"""
from __future__ import annotations

import argparse
import hashlib
import html
from html.parser import HTMLParser
import io
import json
import os
import time
from pathlib import Path, PurePosixPath
import re
import shutil
import sys
import tempfile
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import zipfile
import xml.etree.ElementTree as ET
from typing import Any

import completion_registry as registry

VERSION = 4
SKILL_VERSION = "1.0.0"
USER_AGENT = f"public-domain-book-downloader/{SKILL_VERSION} (+public-domain ebook acquisition)"
SE_BASE = "https://standardebooks.org"
GUTENDEX_BASE = "https://gutendex.com"
DEFAULT_GUTENBERG_MIRROR = "https://gutenberg.pglaf.org"

GDRIVE_CLASSIC2_FOLDER_ID = "168d_X_V_lB2Pv4DTPyTSGipY2yvSeT5f"
GDRIVE_TOKEN_FILE = "/Users/yvoche/AI开发/000.非洲最终正文/token.json"
GDRIVE_SCOPES = ["https://www.googleapis.com/auth/drive"]

SE_EXCLUDE_BASENAMES = {
    "colophon.xhtml",
    "imprint.xhtml",
    "titlepage.xhtml",
    "uncopyright.xhtml",
}
MAX_ZIP_MEMBERS = 10000
MAX_ZIP_UNCOMPRESSED_BYTES = 512 * 1024 * 1024
MAX_DOWNLOAD_BYTES = 512 * 1024 * 1024
GUTENBERG_ASSET_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif",
    ".mp3", ".ogg", ".wav", ".m4a", ".mp4", ".webm",
}

# Conservative structural heading recognition for the TXT fallback. This
# preserves the v3.1 Roman-title fix (`I. Introduction`, `IV — The Return`)
# instead of flattening those lines into prose when Gutenberg has no HTML.
ROMAN_NUMERAL_PATTERN = r"(?=[IVXLCDM]+\b)M{0,3}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})"
ROMAN_TITLE_HEADING_RE = re.compile(
    rf"^\s*(?P<numeral>{ROMAN_NUMERAL_PATTERN})\s*(?:[.):]|[-–—])\s+(?P<title>.+?)\s*$"
)
EN_NUMBERS = (
    "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|"
    "fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|"
    "first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth"
)
SW_NUMBERS = (
    "kwanza|pili|tatu|nne|tano|sita|saba|nane|tisa|kumi|kumi na moja|kumi na mbili|"
    "ishirini|thelathini|arobaini|hamsini"
)
TEXT_HEADING_RE = re.compile(
    rf"^\s*(?:"
    rf"(?:book|part|volume|kitabu|sehemu|juzuu)\s+(?:the\s+|ya\s+)?(?:[ivxlcdm]+|\d+|{EN_NUMBERS}|{SW_NUMBERS})\b|"
    rf"(?:chapter)\s+(?:the\s+)?(?:[ivxlcdm]+|\d+|{EN_NUMBERS})\b|"
    rf"(?:sura)\s+(?:ya\s+)?(?:[ivxlcdm]+|\d+|{SW_NUMBERS})\b|"
    r"prologue\b|epilogue\b|preface\b|introduction\b|contents\s*$|"
    r"utangulizi\b|hitimisho\b|yaliyomo\s*$)",
    re.IGNORECASE,
)


class FetchError(RuntimeError):
    pass


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def json_dump(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2) + "\n"


def atomic_write_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(handle, "wb") as stream:
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


def atomic_write_text(path: Path, text: str) -> None:
    atomic_write_bytes(path, text.encode("utf-8"))


def directory_inventory(root: Path) -> list[dict[str, Any]]:
    if root.is_symlink():
        raise FetchError(f"asset directory must not be a symbolic link: {root}")
    if not root.is_dir():
        return []
    items: list[dict[str, Any]] = []
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            raise FetchError(f"asset directory contains a symbolic link: {path}")
        if not path.is_file():
            continue
        data = path.read_bytes()
        items.append({
            "relative_path": path.relative_to(root).as_posix(),
            "sha256": sha256_bytes(data),
            "bytes": len(data),
        })
    return items


def assert_safe_force_directory(directory: Path, *, protected_paths: tuple[Path, ...] = ()) -> None:
    directory = directory.resolve()
    if directory == Path(directory.anchor) or directory == Path.home().resolve():
        raise FetchError(f"refusing --force deletion of protected directory: {directory}")
    for protected in protected_paths:
        protected = protected.resolve()
        try:
            protected.relative_to(directory)
        except ValueError:
            continue
        raise FetchError(f"refusing --force deletion because output directory contains protected input: {protected}")


def normalize_match_text(value: str) -> str:
    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = value.casefold().replace("’", "'")
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = value.casefold().replace("&", " and ")
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value


def request_bytes(
    url: str,
    *,
    timeout: int = 30,
    headers: dict[str, str] | None = None,
) -> tuple[bytes, dict[str, str], str]:
    all_headers = {"User-Agent": USER_AGENT, "Accept": "*/*"}
    if headers:
        all_headers.update(headers)
    request = urllib.request.Request(url, headers=all_headers)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            response_headers = {k.lower(): v for k, v in response.headers.items()}
            content_length = response_headers.get("content-length")
            if content_length:
                try:
                    if int(content_length) > MAX_DOWNLOAD_BYTES:
                        raise FetchError(f"download exceeds safety limit: {url}: {content_length} bytes")
                except ValueError:
                    pass
            body = response.read(MAX_DOWNLOAD_BYTES + 1)
            if len(body) > MAX_DOWNLOAD_BYTES:
                raise FetchError(f"download exceeds safety limit: {url}: >{MAX_DOWNLOAD_BYTES} bytes")
            final_url = response.geturl()
            return body, response_headers, final_url
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as exc:
        raise FetchError(f"request failed: {url}: {exc}") from exc


def request_json(url: str, *, timeout: int = 30, headers: dict[str, str] | None = None) -> Any:
    body, _, _ = request_bytes(url, timeout=timeout, headers={"Accept": "application/json", **(headers or {})})
    try:
        return json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise FetchError(f"invalid JSON from {url}: {exc}") from exc


class LinkCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[tuple[str, str]] = []
        self._href: str | None = None
        self._text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() == "a":
            self._href = dict(attrs).get("href")
            self._text = []

    def handle_data(self, data: str) -> None:
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "a" and self._href is not None:
            self.links.append((self._href, " ".join(self._text).strip()))
            self._href = None
            self._text = []


def links_from_html(text: str) -> list[tuple[str, str]]:
    parser = LinkCollector()
    parser.feed(text)
    return parser.links


def find_standardebooks_github(page_html: str) -> str | None:
    for href, _ in links_from_html(page_html):
        if re.match(r"https://github\.com/standardebooks/[A-Za-z0-9_.-]+/?$", href):
            return href.rstrip("/")
    match = re.search(r"https://github\.com/standardebooks/[A-Za-z0-9_.-]+", page_html)
    return match.group(0).rstrip("/") if match else None


def candidate_standardebooks_page(title: str, author: str) -> str:
    return f"{SE_BASE}/ebooks/{slugify(author)}/{slugify(title)}"


def standardebooks_search_page(title: str, author: str, timeout: int) -> str | None:
    query = urllib.parse.urlencode({"query": f"{title} {author}"})
    url = f"{SE_BASE}/ebooks?{query}"
    try:
        body, _, _ = request_bytes(url, timeout=timeout, headers={"Accept": "application/xhtml+xml,text/html"})
    except FetchError:
        return None
    text = body.decode("utf-8", errors="replace")
    title_norm = normalize_match_text(title)
    author_slug = slugify(author)
    candidates: list[tuple[int, str]] = []
    for href, anchor_text in links_from_html(text):
        if not href.startswith("/ebooks/") or href.count("/") < 3:
            continue
        full = urllib.parse.urljoin(SE_BASE, href)
        score = 0
        if author_slug:
            if f"/ebooks/{author_slug}/" not in href:
                # Title collisions across authors are possible. A supplied
                # author is a hard acquisition constraint, not a soft hint.
                continue
            score += 5
        anchor_norm = normalize_match_text(anchor_text)
        if title_norm and (title_norm == anchor_norm or title_norm in anchor_norm):
            score += 8
        path_tail = normalize_match_text(href.rsplit("/", 1)[-1].replace("-", " "))
        if title_norm and path_tail == title_norm:
            score += 6
        candidates.append((score, full))
    candidates.sort(reverse=True)
    return candidates[0][1] if candidates and candidates[0][0] >= 6 else None


def discover_standardebooks_repo(title: str, author: str, timeout: int) -> tuple[str, str] | None:
    pages = [candidate_standardebooks_page(title, author)]
    searched = False
    for page_url in pages:
        try:
            body, _, final_url = request_bytes(page_url, timeout=timeout, headers={"Accept": "application/xhtml+xml,text/html"})
        except FetchError:
            if not searched:
                searched = True
                search_result = standardebooks_search_page(title, author, timeout)
                if search_result and search_result not in pages:
                    pages.append(search_result)
            continue
        page_text = body.decode("utf-8", errors="replace")
        repo = find_standardebooks_github(page_text)
        if repo:
            author_slug = slugify(author)
            final_path = urllib.parse.urlparse(final_url).path
            if not author_slug or f"/ebooks/{author_slug}/" in final_path:
                return final_url, repo
            # Do not trust a redirect into a same-title page by another author.
            # Fall through to catalog search with the supplied author constraint.
        # A predictable title URL may resolve successfully but still not be the
        # actual ebook page (or the page markup may change). Do not let a 200
        # response suppress catalog-search fallback.
        if not searched:
            searched = True
            search_result = standardebooks_search_page(title, author, timeout)
            if search_result and search_result not in pages:
                pages.append(search_result)
    return None


def download_github_repo_zip(repo_url: str, timeout: int) -> tuple[bytes, str]:
    repo_name = repo_url.rstrip("/").split("/")[-1]
    for branch in ("master", "main"):
        url = f"https://codeload.github.com/standardebooks/{repo_name}/zip/refs/heads/{branch}"
        try:
            body, _, _ = request_bytes(url, timeout=timeout, headers={"Accept": "application/zip"})
        except FetchError:
            continue
        if body.startswith(b"PK"):
            return body, branch
    raise FetchError(f"could not download public Standard Ebooks Git source: {repo_url}")


def safe_extract_zip(data: bytes, destination: Path) -> None:
    """Extract a ZIP without path traversal or pathological expansion."""
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            infos = zf.infolist()
            if len(infos) > MAX_ZIP_MEMBERS:
                raise FetchError(f"ZIP has too many members: {len(infos)}")
            total = sum(max(0, info.file_size) for info in infos)
            if total > MAX_ZIP_UNCOMPRESSED_BYTES:
                raise FetchError(f"ZIP expands beyond safety limit: {total} bytes")
            root = destination.resolve()
            for info in infos:
                # ZIP member names are POSIX-like even on Windows. Reject
                # archived symlinks too, so extraction cannot create an
                # indirect path outside the intended source tree.
                unix_mode = (info.external_attr >> 16) & 0o170000
                if unix_mode == 0o120000:
                    raise FetchError(f"unsafe ZIP symbolic-link member: {info.filename}")
                member = Path(info.filename)
                if member.is_absolute() or ".." in member.parts:
                    raise FetchError(f"unsafe ZIP member path: {info.filename}")
                target = (destination / member).resolve()
                try:
                    target.relative_to(root)
                except ValueError as exc:
                    raise FetchError(f"unsafe ZIP member path: {info.filename}") from exc
            zf.extractall(destination)
    except zipfile.BadZipFile as exc:
        raise FetchError("downloaded archive is not a valid ZIP") from exc


def _opf_spine_paths(repo_root: Path) -> list[Path]:
    opfs = list(repo_root.rglob("src/epub/content.opf"))
    if not opfs:
        opfs = list(repo_root.rglob("content.opf"))
    if not opfs:
        raise FetchError("Standard Ebooks repository has no content.opf")
    opf = opfs[0]
    try:
        root = ET.parse(opf).getroot()
    except ET.ParseError as exc:
        raise FetchError(f"could not parse Standard Ebooks OPF: {exc}") from exc
    items: dict[str, str] = {}
    for item in root.findall(".//{*}item"):
        item_id = item.attrib.get("id")
        href = item.attrib.get("href")
        media_type = item.attrib.get("media-type", "")
        if item_id and href and (media_type == "application/xhtml+xml" or href.lower().endswith((".xhtml", ".html", ".htm"))):
            items[item_id] = href
    ordered: list[Path] = []
    for itemref in root.findall(".//{*}spine/{*}itemref"):
        ref = itemref.attrib.get("idref")
        href = items.get(ref or "")
        if not href:
            continue
        path = (opf.parent / urllib.parse.unquote(href)).resolve()
        try:
            path.relative_to(repo_root.resolve())
        except ValueError:
            continue
        if path.is_file():
            ordered.append(path)
    if ordered:
        return ordered
    # Fallback for unusual OPF files: deterministic text directory order.
    candidates = sorted(repo_root.rglob("src/epub/text/*.xhtml"))
    if not candidates:
        candidates = sorted(repo_root.rglob("*.xhtml"))
    return candidates


def extract_body_inner(document: str) -> str:
    match = re.search(r"<body\b[^>]*>(?P<body>.*)</body\s*>", document, re.IGNORECASE | re.DOTALL)
    if not match:
        raise FetchError("XHTML/HTML file has no recognizable <body> element")
    return match.group("body")


def _standardebooks_document_anchor(path: Path, epub_root: Path) -> str:
    try:
        relative = path.resolve().relative_to(epub_root.resolve()).as_posix()
    except ValueError:
        relative = path.name
    if "." in relative.rsplit("/", 1)[-1]:
        relative = relative.rsplit(".", 1)[0]
    return f"se-sourcefile-{slugify(relative) or 'document'}"


def _rewrite_standardebooks_refs(body: str, source_path: Path, included_paths: set[Path], epub_root: Path) -> str:
    """Rewrite cross-file XHTML links and distributed-image references.

    Consolidation moves many XHTML files into one document. Relative links such
    as `endnotes.xhtml#note-1` and `../images/foo.svg` would otherwise break.
    """
    file_anchor = {
        path.resolve(): _standardebooks_document_anchor(path, epub_root)
        for path in included_paths
    }
    image_root = (epub_root / "images").resolve()

    attr_re = re.compile(r"(?P<prefix>\b(?:href|src|poster|xlink:href)\s*=\s*)(?P<quote>[\"'])(?P<url>.*?)(?P=quote)", re.I)

    def replace(match: re.Match[str]) -> str:
        raw_url = html.unescape(match.group("url"))
        parsed = urllib.parse.urlparse(raw_url)
        if parsed.scheme or parsed.netloc or raw_url.startswith(("#", "data:")) or not parsed.path:
            return match.group(0)
        target = (source_path.parent / urllib.parse.unquote(parsed.path)).resolve()
        new_url: str | None = None
        if target in included_paths:
            if parsed.fragment:
                new_url = f"#{parsed.fragment}"
            elif target != source_path.resolve():
                new_url = f"#{file_anchor[target]}"
        else:
            try:
                relative_image = target.relative_to(image_root)
            except ValueError:
                relative_image = None
            if relative_image is not None:
                new_url = "assets/images/" + relative_image.as_posix()
                if parsed.fragment:
                    new_url += f"#{parsed.fragment}"
        if new_url is None:
            return match.group(0)
        escaped = html.escape(new_url, quote=True)
        return f"{match.group('prefix')}{match.group('quote')}{escaped}{match.group('quote')}"

    return attr_re.sub(replace, body)


def consolidate_standardebooks(
    repo_root: Path,
    title: str,
    author: str,
    *,
    assets_dir: Path | None = None,
) -> tuple[str, list[str]]:
    paths = _opf_spine_paths(repo_root)
    included: list[Path] = []
    for path in paths:
        if path.name.lower() in SE_EXCLUDE_BASENAMES:
            continue
        included.append(path)
    if not included:
        raise FetchError("Standard Ebooks source has no content XHTML after administrative-file filtering")
    sections: list[str] = []
    rels: list[str] = []
    included_set = {path.resolve() for path in included}
    # content.opf lives at src/epub/content.opf in normal repositories.
    epub_root_candidates = [p.parent for p in repo_root.rglob("src/epub/content.opf")]
    if not epub_root_candidates:
        epub_root_candidates = [p.parent for p in repo_root.rglob("content.opf")]
    epub_root = epub_root_candidates[0] if epub_root_candidates else repo_root

    if assets_dir is not None:
        source_images = epub_root / "images"
        target_images = assets_dir / "images"
        if source_images.is_dir():
            if target_images.exists():
                shutil.rmtree(target_images)
            target_images.parent.mkdir(parents=True, exist_ok=True)
            shutil.copytree(source_images, target_images)

    for path in included:
        text = path.read_text(encoding="utf-8-sig")
        body = _rewrite_standardebooks_refs(extract_body_inner(text), path.resolve(), included_set, epub_root.resolve())
        rel = str(path.resolve().relative_to(repo_root.resolve())).replace(os.sep, "/")
        rels.append(rel)
        anchor = _standardebooks_document_anchor(path, epub_root)
        sections.append(f'<section id="{anchor}" class="source-document" data-source-file="{html.escape(rel, quote=True)}">\n{body.strip()}\n</section>')
    lang = "en"
    doc = (
        "<!doctype html>\n"
        f'<html lang="{lang}">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        f"<title>{html.escape(title)} — {html.escape(author)}</title>\n"
        "</head>\n<body>\n<main class=\"book-source\">\n"
        + "\n\n".join(sections)
        + "\n</main>\n</body>\n</html>\n"
    )
    return doc, rels


def try_standardebooks(title: str, author: str, out_dir: Path, timeout: int) -> dict[str, Any] | None:
    discovered = discover_standardebooks_repo(title, author, timeout)
    if not discovered:
        return None
    page_url, repo_url = discovered
    archive, branch = download_github_repo_zip(repo_url, timeout)
    raw_dir = out_dir / "raw"
    archive_path = raw_dir / "standardebooks-source.zip"
    atomic_write_bytes(archive_path, archive)
    extract_dir = raw_dir / "standardebooks_repo"
    if extract_dir.exists():
        shutil.rmtree(extract_dir)
    extract_dir.mkdir(parents=True)
    safe_extract_zip(archive, extract_dir)
    roots = [p for p in extract_dir.iterdir() if p.is_dir()]
    repo_root = roots[0] if len(roots) == 1 else extract_dir
    working, xhtml_files = consolidate_standardebooks(repo_root, title, author, assets_dir=out_dir / "assets")
    working_path = out_dir / "working_source.html"
    atomic_write_text(working_path, working)
    return {
        "provider": "standardebooks",
        "priority": 1,
        "source_page": page_url,
        "source_repository": repo_url,
        "source_branch": branch,
        "raw_archive": str(archive_path),
        "raw_archive_sha256": sha256_bytes(archive),
        "working_source": str(working_path),
        "working_source_sha256": sha256_file(working_path),
        "source_format": "xhtml-consolidated-to-html",
        "xhtml_files": xhtml_files,
        "assets_dir": str(out_dir / "assets") if (out_dir / "assets").is_dir() else None,
        "asset_files": directory_inventory(out_dir / "assets"),
        "administrative_files_excluded": sorted(SE_EXCLUDE_BASENAMES),
    }


def score_gutendex_book(book: dict[str, Any], title: str, author: str) -> int:
    score = 0
    wanted_title = normalize_match_text(title)
    got_title = normalize_match_text(str(book.get("title", "")))
    if wanted_title == got_title:
        score += 50
    elif wanted_title and (wanted_title in got_title or got_title in wanted_title):
        score += 30
    wanted_author = normalize_match_text(author)
    authors = [normalize_match_text(str(person.get("name", ""))) for person in book.get("authors", [])]
    # Gutenberg/Gutendex commonly stores "Austen, Jane"; compare token sets too.
    wanted_tokens = set(wanted_author.split())
    author_matched = False
    for got in authors:
        got_tokens = set(got.split())
        if wanted_author == got:
            score += 30
            author_matched = True
            break
        if wanted_tokens and wanted_tokens <= got_tokens:
            score += 25
            author_matched = True
            break
        if wanted_tokens and len(wanted_tokens & got_tokens) >= max(1, len(wanted_tokens) - 1):
            score += 15
            author_matched = True
            break
    if wanted_author and not author_matched:
        # Exact-title collisions are common in large catalogs. A supplied
        # author must materially match; title alone is not sufficient.
        score -= 60
    if book.get("copyright") is False:
        score += 10
    if "en" in book.get("languages", []):
        score += 5
    return score


def _gutendex_results(url: str, timeout: int, max_pages: int = 3) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    next_url: str | None = url
    pages = 0
    while next_url and pages < max_pages:
        data = request_json(next_url, timeout=timeout)
        results.extend(list(data.get("results") or []))
        next_value = data.get("next")
        next_url = str(next_value) if next_value else None
        pages += 1
    return results


def gutendex_lookup(title: str, author: str, timeout: int) -> dict[str, Any] | None:
    params = urllib.parse.urlencode({
        "search": f"{title} {author}",
        "languages": "en",
        "copyright": "false",
    })
    results = _gutendex_results(f"{GUTENDEX_BASE}/books?{params}", timeout=timeout)
    if not results:
        # Some works have sparse author indexing; title-only fallback.
        params = urllib.parse.urlencode({"search": title, "languages": "en", "copyright": "false"})
        results = _gutendex_results(f"{GUTENDEX_BASE}/books?{params}", timeout=timeout)
    if not results:
        return None
    ranked = sorted(((score_gutendex_book(book, title, author), book) for book in results), key=lambda item: item[0], reverse=True)
    return ranked[0][1] if ranked[0][0] >= 40 else None


def mirror_url(url: str, mirror_base: str) -> str:
    parsed = urllib.parse.urlparse(url)
    mirror = urllib.parse.urlparse(mirror_base.rstrip("/"))
    prefix = mirror.path.rstrip("/")
    target_path = f"{prefix}{parsed.path}" if prefix else parsed.path
    return urllib.parse.urlunparse((mirror.scheme or "https", mirror.netloc, target_path, parsed.params, parsed.query, parsed.fragment))


def format_candidates(book: dict[str, Any], mirror_base: str) -> list[tuple[str, str]]:
    formats = book.get("formats") or {}
    candidates: list[tuple[int, str, str]] = []
    for mime, url in formats.items():
        if not url:
            continue
        mime_lower = mime.lower()
        if mime_lower.startswith("text/html"):
            rank = 0 if "utf-8" in mime_lower else 1
            candidates.append((rank, "html", mirror_url(str(url), mirror_base)))
        elif mime_lower.startswith("text/plain"):
            rank = 2 if "utf-8" in mime_lower else 3
            candidates.append((rank, "text", mirror_url(str(url), mirror_base)))
    candidates.sort(key=lambda item: item[0])
    return [(kind, url) for _, kind, url in candidates]


def generated_mirror_candidates(book_id: int, mirror_base: str) -> list[tuple[str, str]]:
    base = mirror_base.rstrip("/")
    return [
        ("html", f"{base}/cache/epub/{book_id}/pg{book_id}-images.html"),
        ("html_zip", f"{base}/cache/epub/{book_id}/pg{book_id}-h.zip"),
        ("html", f"{base}/cache/epub/{book_id}/pg{book_id}-h.html"),
        ("html", f"{base}/cache/epub/{book_id}/pg{book_id}-h.htm"),
        ("text", f"{base}/cache/epub/{book_id}/pg{book_id}.txt"),
        ("text", f"{base}/cache/epub/{book_id}/pg{book_id}.txt.utf-8"),
    ]


def decode_text_bytes(data: bytes, content_type: str = "") -> str:
    # UTF-8 is preferred by the acquisition policy. If the server explicitly
    # declares a charset, honor it first, then fall back conservatively.
    encodings: list[str] = []
    match = re.search(r"charset\s*=\s*[\"']?([A-Za-z0-9._-]+)", content_type, re.I)
    if match:
        encodings.append(match.group(1))
    encodings.extend(("utf-8-sig", "utf-8", "windows-1252", "latin-1"))
    seen: set[str] = set()
    for encoding in encodings:
        key = encoding.casefold()
        if key in seen:
            continue
        seen.add(key)
        try:
            return data.decode(encoding)
        except (UnicodeDecodeError, LookupError):
            continue
    return data.decode("utf-8", errors="replace")


class BoilerplateRangeParser(HTMLParser):
    """Find modern Project Gutenberg pg-boilerplate div ranges by source offset."""
    def __init__(self, source: str) -> None:
        super().__init__(convert_charrefs=False)
        self.source = source
        self.line_starts = [0]
        for match in re.finditer(r"\n", source):
            self.line_starts.append(match.end())
        self.stack: list[tuple[str, int | None]] = []
        self.ranges: list[tuple[int, int]] = []

    def abspos(self) -> int:
        line, col = self.getpos()
        return self.line_starts[line - 1] + col

    def _tag_end(self, start: int) -> int:
        end = self.source.find(">", start)
        return len(self.source) if end == -1 else end + 1

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        start = self.abspos()
        attr_map = {k.lower(): (v or "") for k, v in attrs}
        cls = attr_map.get("class", "")
        ident = attr_map.get("id", "")
        boiler = tag == "div" and ("pg-boilerplate" in cls.split() or ident in {"pg-header", "pg-footer"})
        marker = start if boiler else None
        self.stack.append((tag, marker))

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        pass

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        end_start = self.abspos()
        for idx in range(len(self.stack) - 1, -1, -1):
            stack_tag, marker = self.stack[idx]
            if stack_tag == tag:
                del self.stack[idx:]
                if marker is not None:
                    self.ranges.append((marker, self._tag_end(end_start)))
                return


def strip_modern_gutenberg_boilerplate(source: str) -> tuple[str, list[tuple[int, int]], bool]:
    parser = BoilerplateRangeParser(source)
    try:
        parser.feed(source)
    except Exception:
        return source, [], False
    ranges = sorted(parser.ranges)
    if not ranges:
        return source, [], False
    parts: list[str] = []
    cursor = 0
    for start, end in ranges:
        if start < cursor:
            continue
        parts.append(source[cursor:start])
        cursor = end
    parts.append(source[cursor:])
    return "".join(parts), ranges, True


def strip_gutenberg_text_boilerplate(source: str) -> tuple[str, dict[str, Any]]:
    start_re = re.compile(r"^\*{3}\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*?\*{3}\s*$", re.I | re.M)
    end_re = re.compile(r"^\*{3}\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*?\*{3}\s*$", re.I | re.M)
    start = start_re.search(source)
    end = end_re.search(source, start.end() if start else 0)
    if start and end and end.start() >= start.end():
        payload = source[start.end():end.start()].strip("\r\n")
        return payload, {"removed": True, "method": "canonical-text-markers", "start": start.start(), "end": end.end()}
    return source, {"removed": False, "method": "none", "warning": "canonical Gutenberg START/END markers not found"}


def _looks_like_roman_title_heading(text: str) -> bool:
    if len(text.strip()) > 180:
        return False
    match = ROMAN_TITLE_HEADING_RE.fullmatch(text.strip())
    if not match:
        return False
    tail = match.group("title").strip()
    words = re.findall(r"[A-Za-zÀ-ÖØ-öø-ÿ0-9]+(?:['’][A-Za-zÀ-ÖØ-öø-ÿ]+)?", tail)
    if not tail or len(words) > 18:
        return False
    meaningful = tail.lstrip('"“”‘’«»([{')
    if not meaningful:
        return False
    return meaningful[0].isupper() or meaningful[0].isdigit()


def _looks_like_text_heading(text: str) -> bool:
    stripped = text.strip()
    if not stripped or len(stripped) > 200:
        return False
    if _looks_like_roman_title_heading(stripped):
        return True
    return bool(TEXT_HEADING_RE.match(stripped))


def _looks_like_hard_wrapped_prose(raw_lines: list[str]) -> bool:
    """Detect Gutenberg-style physical line wrapping inside one prose block.

    Gutenberg TXT commonly wraps prose near 60-80 columns. This detector is
    intentionally conservative: it only upgrades a multi-line block to prose
    when the block has enough prose-like words and most non-final lines are
    wrap-width lines without structural indentation/headings. Short verse,
    tables of contents, and other line-oriented material stay eligible for
    ``preserve-lines``.
    """
    lines = [line.rstrip() for line in raw_lines if line.strip()]
    if len(lines) < 2:
        return False
    if any(re.match(r"^\s{2,}\S", line) for line in lines):
        return False
    stripped = [line.strip() for line in lines]
    if any(_looks_like_text_heading(line) for line in stripped):
        return False
    joined = " ".join(stripped)
    words = re.findall(r"[A-Za-zÀ-ÖØ-öø-ÿ0-9]+(?:['’][A-Za-zÀ-ÖØ-öø-ÿ]+)?", joined)
    if len(words) < 24:
        return False
    non_final = stripped[:-1]
    if not non_final:
        return False
    wrap_width = [45 <= len(line) <= 95 for line in non_final]
    if sum(wrap_width) < max(1, (len(non_final) * 2 + 2) // 3):
        return False
    # Poetry and lists often end most physical lines on deliberate punctuation;
    # hard-wrapped prose more often breaks mid-clause or mid-sentence.
    deliberate_end = re.compile(r"[.!?;:][\"'’”)]?$|[-–—]$")
    deliberate = sum(bool(deliberate_end.search(line)) for line in non_final)
    if len(non_final) >= 3 and deliberate / len(non_final) > 0.75:
        return False
    return True


def plain_text_to_html_with_info(source: str, title: str, author: str, lang: str = "en") -> tuple[str, dict[str, Any]]:
    # Deterministic source normalization only. We do not infer mobile paragraph
    # rhythm here; the Agent still owns all later mobile paragraph decisions.
    # This layer only removes Gutenberg's physical column wrapping where the
    # surrounding blank-line block is confidently prose.
    # Normalize newline encoding before block detection. Without this, a
    # backtracking regex can split one CRLF into ``\r`` + ``\n`` and falsely
    # treat every physical Gutenberg wrap as a blank-line paragraph break.
    normalized_source = source.replace("\r\n", "\n").replace("\r", "\n")
    blocks = [b for b in re.split(r"\n[ \t]*(?:\n[ \t]*)+", normalized_source) if b.strip()]
    body: list[str] = []
    hard_wrap_blocks = 0
    hard_wrap_lines_merged = 0
    preserve_line_blocks = 0
    heading_blocks = 0
    paragraph_blocks = 0
    for block in blocks:
        stripped = block.strip()
        raw_lines = [line for line in stripped.split("\n") if line.strip()]
        lines = [line.strip() for line in raw_lines]
        looks_heading = len(lines) == 1 and _looks_like_text_heading(stripped)
        hard_wrapped_prose = _looks_like_hard_wrapped_prose(raw_lines)
        if looks_heading:
            heading_blocks += 1
            body.append(f"<h2>{html.escape(stripped)}</h2>")
        elif hard_wrapped_prose:
            paragraph_blocks += 1
            hard_wrap_blocks += 1
            hard_wrap_lines_merged += max(0, len(lines) - 1)
            body.append(f"<p>{html.escape(' '.join(lines))}</p>")
        elif len(lines) > 1 and all(len(line) < 90 for line in lines) and not re.search(r"[.!?][\"'’”)]?\s*$", stripped):
            preserve_line_blocks += 1
            body.append("<div class=\"preserve-lines\">" + "<br>\n".join(html.escape(line) for line in lines) + "</div>")
        else:
            paragraph_blocks += 1
            paragraph = " ".join(lines)
            body.append(f"<p>{html.escape(paragraph)}</p>")
    document = (
        f"<!doctype html>\n<html lang=\"{html.escape(lang, quote=True)}\">\n<head>\n<meta charset=\"utf-8\">\n"
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        f"<title>{html.escape(title)} — {html.escape(author)}</title>\n</head>\n<body>\n"
        '<main class="book-source">\n' + "\n\n".join(body) + "\n</main>\n</body>\n</html>\n"
    )
    info = {
        "method": "gutenberg-hard-wrap-aware",
        "source_blocks": len(blocks),
        "heading_blocks": heading_blocks,
        "paragraph_blocks": paragraph_blocks,
        "preserve_line_blocks": preserve_line_blocks,
        "hard_wrap_blocks_merged": hard_wrap_blocks,
        "physical_line_breaks_removed": hard_wrap_lines_merged,
        "text_content_changed": False,
    }
    return document, info


def plain_text_to_html(source: str, title: str, author: str, lang: str = "en") -> str:
    return plain_text_to_html_with_info(source, title, author, lang)[0]


def extract_html_from_zip(data: bytes) -> tuple[str, str] | None:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            infos = zf.infolist()
            if len(infos) > MAX_ZIP_MEMBERS:
                raise FetchError(f"Gutenberg ZIP has too many members: {len(infos)}")
            total = sum(max(0, info.file_size) for info in infos)
            if total > MAX_ZIP_UNCOMPRESSED_BYTES:
                raise FetchError(f"Gutenberg ZIP expands beyond safety limit: {total} bytes")
            html_infos = [
                info for info in infos
                if info.filename.lower().endswith((".html", ".htm", ".xhtml")) and not info.is_dir()
            ]
            if not html_infos:
                return None
            # Prefer the largest HTML file: PG HTML ZIPs may include auxiliary files.
            info = max(html_infos, key=lambda item: item.file_size)
            return decode_text_bytes(zf.read(info)), info.filename
    except zipfile.BadZipFile:
        return None


def localize_gutenberg_assets(document: str, base_url: str, out_dir: Path, timeout: int) -> tuple[str, dict[str, Any]]:
    """Localize same-book media references used by Gutenberg HTML.

    Gutenberg generated HTML commonly uses relative `images/...` URLs. A final
    HTML file published at another origin would otherwise break those images.
    We only download media whose resolved path stays in the same book directory;
    same-host references outside that directory are made absolute instead.
    Failed same-book downloads are also made absolute so the HTML remains usable
    while the provenance manifest records that it is not fully self-contained.
    """
    attr_re = re.compile(
        r"(?P<prefix>\b(?:src|poster)\s*=\s*)(?P<quote>[\"'])(?P<url>.*?)(?P=quote)",
        re.I,
    )
    base = urllib.parse.urlparse(base_url)
    base_dir = base.path.rsplit("/", 1)[0] + "/"
    base_dir_path = PurePosixPath(urllib.parse.unquote(base_dir))
    refs = []
    for match in attr_re.finditer(document):
        value = html.unescape(match.group("url")).strip()
        if value and value not in refs:
            refs.append(value)

    replacements: dict[str, str] = {}
    downloaded: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []
    absolute_fallbacks: list[str] = []
    assets_dir = out_dir / "assets"

    for value in refs:
        compact = re.sub(r"[\x00-\x20]+", "", value).lower()
        if compact.startswith(("data:", "javascript:", "vbscript:", "#")):
            continue
        absolute = urllib.parse.urljoin(base_url, value)
        parsed = urllib.parse.urlparse(absolute)
        if parsed.scheme not in {"http", "https"} or parsed.netloc != base.netloc:
            continue
        clean_path = PurePosixPath(urllib.parse.unquote(parsed.path))
        try:
            rel = clean_path.relative_to(base_dir_path)
        except ValueError:
            # Keep a stable absolute URL rather than a relative URL that would
            # resolve against the eventual Cloudflare page path.
            if not urllib.parse.urlparse(value).scheme:
                replacements[value] = absolute
                absolute_fallbacks.append(absolute)
            continue
        if not rel.parts or any(part in {"", ".", ".."} for part in rel.parts):
            continue
        if clean_path.suffix.lower() not in GUTENBERG_ASSET_EXTENSIONS:
            continue
        try:
            data, _, final_url = request_bytes(absolute, timeout=timeout)
        except FetchError as exc:
            replacements[value] = absolute
            absolute_fallbacks.append(absolute)
            errors.append({"url": absolute, "error": str(exc)})
            continue
        target = assets_dir.joinpath(*rel.parts)
        atomic_write_bytes(target, data)
        local_ref = "assets/" + "/".join(rel.parts)
        replacements[value] = local_ref
        downloaded.append({
            "source_url": final_url,
            "local_file": str(target),
            "sha256": sha256_bytes(data),
            "bytes": len(data),
        })

    def replace(match: re.Match[str]) -> str:
        original = html.unescape(match.group("url")).strip()
        replacement = replacements.get(original)
        if replacement is None:
            return match.group(0)
        return f"{match.group('prefix')}{match.group('quote')}{html.escape(replacement, quote=True)}{match.group('quote')}"

    rewritten = attr_re.sub(replace, document)
    info = {
        "downloaded": downloaded,
        "download_errors": errors,
        "absolute_fallbacks": sorted(set(absolute_fallbacks)),
        "assets_dir": str(assets_dir) if downloaded else None,
        "fully_localized": not errors and not absolute_fallbacks,
    }
    return rewritten, info


def try_gutenberg(
    title: str,
    author: str,
    out_dir: Path,
    timeout: int,
    mirror_base: str,
) -> dict[str, Any] | None:
    book = gutendex_lookup(title, author, timeout)
    if not book:
        return None
    book_id = int(book["id"])
    candidates = format_candidates(book, mirror_base) + generated_mirror_candidates(book_id, mirror_base)
    seen: set[str] = set()
    raw_dir = out_dir / "raw"
    errors: list[str] = []
    for kind, url in candidates:
        if url in seen:
            continue
        seen.add(url)
        try:
            data, headers, final_url = request_bytes(url, timeout=timeout)
        except FetchError as exc:
            errors.append(str(exc))
            continue
        content_type = headers.get("content-type", "")
        actual_kind = kind
        raw_name = Path(urllib.parse.urlparse(final_url).path).name or f"pg{book_id}"
        raw_archive_path: Path | None = None
        raw_archive_sha256: str | None = None
        if kind == "html_zip" or data.startswith(b"PK"):
            extracted = extract_html_from_zip(data)
            if not extracted:
                errors.append(f"ZIP had no HTML: {url}")
                continue
            html_text, inner_name = extracted
            raw_archive_path = raw_dir / (raw_name if raw_name.lower().endswith(".zip") else f"{raw_name}.zip")
            atomic_write_bytes(raw_archive_path, data)
            raw_archive_sha256 = sha256_bytes(data)
            raw_path = raw_dir / Path(inner_name).name
            atomic_write_text(raw_path, html_text)
            actual_kind = "html"
        elif kind == "html" or "html" in content_type.lower() or b"<html" in data[:2048].lower():
            html_text = decode_text_bytes(data, content_type)
            raw_path = raw_dir / (raw_name if raw_name.lower().endswith((".html", ".htm", ".xhtml")) else f"pg{book_id}.html")
            atomic_write_bytes(raw_path, data)
            actual_kind = "html"
        else:
            text = decode_text_bytes(data, content_type)
            raw_path = raw_dir / (raw_name if raw_name.lower().endswith(".txt") else f"pg{book_id}.txt")
            atomic_write_bytes(raw_path, data)
            actual_kind = "text"

        working_path = out_dir / "working_source.html"
        boilerplate_info: dict[str, Any]
        asset_info: dict[str, Any] | None = None
        if actual_kind == "html":
            cleaned, ranges, stripped = strip_modern_gutenberg_boilerplate(html_text)
            boilerplate_info = {
                "removed": stripped,
                "method": "pg-boilerplate-div" if stripped else "none",
                "removed_ranges": ranges,
            }
            working, asset_info = localize_gutenberg_assets(cleaned, final_url, out_dir, timeout)
        else:
            payload, boilerplate_info = strip_gutenberg_text_boilerplate(text)
            working, text_normalization_info = plain_text_to_html_with_info(payload, title, author, "en")
        atomic_write_text(working_path, working)
        return {
            "provider": "project-gutenberg",
            "priority": 2 if actual_kind == "html" else 3,
            "gutendex_id": book_id,
            "gutendex_title": book.get("title"),
            "gutendex_authors": book.get("authors", []),
            "gutendex_languages": book.get("languages", []),
            "gutendex_copyright": book.get("copyright"),
            "download_url": final_url,
            "mirror_base": mirror_base,
            "download_kind": actual_kind,
            "raw_source": str(raw_path),
            "raw_source_sha256": sha256_file(raw_path),
            "raw_archive": str(raw_archive_path) if raw_archive_path is not None else None,
            "raw_archive_sha256": raw_archive_sha256,
            "working_source": str(working_path),
            "working_source_sha256": sha256_file(working_path),
            "source_format": "html" if actual_kind == "html" else "text-derived-html",
            "boilerplate": boilerplate_info,
            "text_normalization": text_normalization_info if actual_kind == "text" else None,
            "assets_dir": (asset_info or {}).get("assets_dir") if actual_kind == "html" else None,
            "asset_files": directory_inventory(out_dir / "assets"),
            "asset_localization": asset_info,
            "attempt_errors_before_success": errors,
        }
    raise FetchError(f"Gutendex found Gutenberg #{book_id}, but all mirror downloads failed")


def reset_working_derivatives(out_dir: Path) -> None:
    """Remove provider-specific derivatives before trying the next provider.

    Failed acquisition attempts may leave an incomplete working HTML or asset
    tree. Raw attempt artifacts are retained for diagnostics, but derivatives
    must never bleed into the next selected provider.
    """
    working = out_dir / "working_source.html"
    if working.exists():
        working.unlink()
    assets = out_dir / "assets"
    if assets.exists():
        shutil.rmtree(assets)


FORMAT_PRIORITY = {
    "mobile_html": 3,
    "mobile_markdown": 3,
    "html_source": 2,
    "download_pending": 1,
}

PUBLICATION_READONLY_KEYS = {
    "mobile_html_file",
    "content_html_file",
    "mobile_markdown_file",
    "qa_report_file",
    "publication_manifest_file",
    "word_count",
    "chapter_count",
    "completed_at",
    "cover_image",
    "skill_version",
}


def merge_download_record(existing: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
    """Field-level non-destructive merge.

    Download Worker only owns source/download namespace.
    It CANNOT downgrade format = mobile_html / mobile_markdown back to html_source.
    It CANNOT wipe publication/QA fields written by Mobile Formatter.
    """
    merged = dict(existing)

    # 1. Update/Add source/download fields owned by Downloader
    source_keys = [
        "version",
        "relative_path",
        "source_provider",
        "source_url",
        "source_format",
        "source_manifest_file",
        "working_source_file",
        "raw_source",
        "asset_files",
        "downloaded_at",
        "selected",
    ]
    for k in source_keys:
        if k in incoming:
            merged[k] = incoming[k]

    # 2. Non-destructive format priority check
    existing_fmt = str(existing.get("format", ""))
    incoming_fmt = str(incoming.get("format", "html_source"))

    existing_prio = FORMAT_PRIORITY.get(existing_fmt, 0)
    incoming_prio = FORMAT_PRIORITY.get(incoming_fmt, 0)

    if incoming_prio > existing_prio:
        merged["format"] = incoming_fmt
    else:
        merged["format"] = existing_fmt  # Preserve higher priority format (e.g. mobile_html)

    # 3. Explicit protection: Never wipe publication/QA fields
    for k in PUBLICATION_READONLY_KEYS:
        if k in existing and existing[k] is not None:
            # But allow upgrades from same or higher priority formats
            if incoming_prio >= existing_prio and k in incoming and incoming[k] is not None:
                merged[k] = incoming[k]
            else:
                merged[k] = existing[k]

    return merged


def verify_catalog_integrity(catalog_data: list[dict[str, Any]], title: str, author: str, slug: str) -> None:
    """Read-back verification of catalog data after update."""
    if not isinstance(catalog_data, list):
        raise FetchError("Read-back verification failed: catalog is not a JSON list")

    ids = [item.get("id") for item in catalog_data if isinstance(item, dict) and "id" in item]
    if len(ids) != len(set(ids)):
        raise FetchError("Read-back verification failed: duplicate IDs detected in canonical catalog")

    # Verify target book exists and has not been downgraded
    found_target = False
    for item in catalog_data:
        if not isinstance(item, dict):
            continue
        item_title = str(item.get("title", "")).strip().lower()
        item_author = str(item.get("author", "")).strip().lower()
        item_slug = str(item.get("slug", "")).strip().lower()

        if (item_title == title.strip().lower() and item_author == author.strip().lower()) or item_slug == slug.strip().lower():
            found_target = True
            fmt = item.get("format")
            if fmt not in {"html_source", "mobile_html", "mobile_markdown"}:
                raise FetchError(f"Read-back verification failed: unexpected format '{fmt}' for {title}")
            break

    if not found_target:
        raise FetchError(f"Read-back verification failed: target book '{title}' by '{author}' not found in re-read catalog")


def sync_canonical_catalog_with_gdrive(service: Any, title: str, author: str, book_folder_name: str, pub_data: dict[str, Any] = None) -> dict[str, Any]:
    """Fetch latest canonical catalog from Google Drive, perform field-level merge,

    check optimistic concurrency lock via modifiedTime, write back, and read-back verify.
    """
    from googleapiclient.http import MediaFileUpload, MediaIoBaseDownload
    import io

    file_id = registry.REGISTRY_FILE_ID
    slug = registry.slugify(title)
    max_retries = 5

    for attempt in range(max_retries):
        # Step 1: Fetch latest file metadata (modifiedTime) and content from Google Drive
        meta = service.files().get(fileId=file_id, fields="id, modifiedTime, name").execute()
        initial_modified_time = meta.get("modifiedTime")

        request = service.files().get_media(fileId=file_id)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()

        raw_json = fh.getvalue().decode("utf-8")
        catalog_data = json.loads(raw_json)

        # Step 2: Find target item by title+author or slug
        matched_idx = -1
        for idx, item in enumerate(catalog_data):
            if not isinstance(item, dict):
                continue
            item_title = str(item.get("title", "")).strip().lower()
            item_author = str(item.get("author", "")).strip().lower()
            item_slug = str(item.get("slug", "")).strip().lower()

            if (item_title == title.strip().lower() and item_author == author.strip().lower()) or item_slug == slug.strip().lower():
                matched_idx = idx
                break

        incoming_record = {
            "slug": slug,
            "title": title,
            "author": author,
            "version": "1.0.0",
            "format": "html_source",
            "relative_path": f"0.1英文经典/{book_folder_name}/",
        }
        if pub_data:
            incoming_record.update(pub_data)
            # Support upgrading format implicitly from publication data
            if "full_html_file" in pub_data or "mobile_html_file" in pub_data:
                incoming_record["format"] = "mobile_html"
            if "full_html_file" in pub_data:
                # Path is already imported at the top of the file, but we need to use os.path.basename to avoid shadowing issues
                import os
                incoming_record["mobile_html_file"] = os.path.basename(pub_data["full_html_file"])

        if matched_idx >= 0:
            existing_record = catalog_data[matched_idx]
            merged_record = merge_download_record(existing_record, incoming_record)
            catalog_data[matched_idx] = merged_record
        else:
            max_id = max([item.get("id", 0) for item in catalog_data if isinstance(item, dict) and isinstance(item.get("id"), int)], default=0)
            incoming_record["id"] = max_id + 1
            catalog_data.append(incoming_record)

        # Step 3: Check optimistic concurrency lock (modifiedTime)
        latest_meta = service.files().get(fileId=file_id, fields="modifiedTime").execute()
        if latest_meta.get("modifiedTime") != initial_modified_time:
            # Concurrent modification detected! Retry fetch & merge.
            time.sleep(0.5)
            continue

        # Step 4: Write updated JSON to temp file and upload to Google Drive
        temp_catalog = Path(tempfile.gettempdir()) / f"classics_catalog_sync_{int(time.time()*1000)}.json"
        temp_catalog.write_text(json.dumps(catalog_data, ensure_ascii=False, indent=2), encoding="utf-8")

        try:
            media = MediaFileUpload(str(temp_catalog), mimetype="application/json", resumable=True)
            service.files().update(fileId=file_id, media_body=media).execute()
        finally:
            if temp_catalog.exists():
                temp_catalog.unlink()

        # Step 5: Read-back verify from Google Drive
        verify_fh = io.BytesIO()
        verify_req = service.files().get_media(fileId=file_id)
        verify_downloader = MediaIoBaseDownload(verify_fh, verify_req)
        v_done = False
        while not v_done:
            _, v_done = verify_downloader.next_chunk()

        readback_data = json.loads(verify_fh.getvalue().decode("utf-8"))
        verify_catalog_integrity(readback_data, title, author, slug)

        # Step 6: Sync verified catalog to local disk copy
        local_catalog_path = Path("/Users/yvoche/AI开发/000.非洲最终正文/0.1英文经典/classics_catalog.json")
        if local_catalog_path.parent.exists():
            local_catalog_path.write_text(json.dumps(readback_data, ensure_ascii=False, indent=2), encoding="utf-8")

        return {"local_catalog": "updated", "gdrive_catalog": "synced_and_verified"}

    raise FetchError("Optimistic concurrency check failed: catalog modified concurrently multiple times")


def upload_book_to_gdrive(out_dir: Path, title: str = "", author: str = "") -> dict[str, Any]:
    """Upload completed book directory to Google Drive folder 英文经典2, and update classics_catalog.json."""
    if not os.path.exists(GDRIVE_TOKEN_FILE):
        return {"status": "skipped", "reason": "token.json not found"}
    try:
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaFileUpload

        creds = Credentials.from_authorized_user_file(GDRIVE_TOKEN_FILE, GDRIVE_SCOPES)
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        service = build("drive", "v3", credentials=creds)

        def get_existing(parent_id: str) -> dict[str, dict[str, Any]]:
            q = f"'{parent_id}' in parents and trashed = false"
            res = service.files().list(q=q, fields="files(id, name, mimeType)").execute()
            return {item["name"]: item for item in res.get("files", [])}

        book_folder_name = out_dir.name
        existing_root = get_existing(GDRIVE_CLASSIC2_FOLDER_ID)

        if book_folder_name in existing_root and existing_root[book_folder_name]["mimeType"] == "application/vnd.google-apps.folder":
            book_folder_id = existing_root[book_folder_name]["id"]
        else:
            meta = {
                "name": book_folder_name,
                "mimeType": "application/vnd.google-apps.folder",
                "parents": [GDRIVE_CLASSIC2_FOLDER_ID]
            }
            created = service.files().create(body=meta, fields="id").execute()
            book_folder_id = created["id"]

        def upload_dir(local_path: Path, parent_id: str):
            existing = get_existing(parent_id)
            for item in sorted(local_path.iterdir()):
                if item.name.startswith('.'):
                    continue
                if item.is_dir():
                    if item.name in existing and existing[item.name]["mimeType"] == "application/vnd.google-apps.folder":
                        sub_id = existing[item.name]["id"]
                    else:
                        f_meta = {"name": item.name, "mimeType": "application/vnd.google-apps.folder", "parents": [parent_id]}
                        c = service.files().create(body=f_meta, fields="id").execute()
                        sub_id = c["id"]
                    upload_dir(item, sub_id)
                elif item.is_file():
                    # Clear out duplicates if it exists (e.g., from direct_reupload)
                    if item.name in existing:
                        service.files().delete(fileId=existing[item.name]["id"]).execute()

                    ext = item.suffix.lower()
                    if ext == ".json":
                        mimetype = "application/json"
                    elif ext in (".txt", ".md"):
                        mimetype = "text/plain" if ext == ".txt" else "text/markdown"
                    elif ext in (".html", ".htm", ".xhtml"):
                        mimetype = "text/html"
                    elif ext == ".svg":
                        mimetype = "image/svg+xml"
                    else:
                        mimetype = "application/octet-stream"

                    media = MediaFileUpload(str(item), mimetype=mimetype, resumable=True)
                    f_meta = {"name": item.name, "parents": [parent_id]}
                    service.files().create(body=f_meta, media_body=media, fields="id").execute()

        upload_dir(out_dir, book_folder_id)

        # Look for publication.json to update metadata in catalog
        pub_data = None
        for pfile in out_dir.glob("*.publication.json"):
            try:
                pub_data = __import__("json").loads(pfile.read_text(encoding="utf-8"))
                break
            except Exception:
                pass

        # Execute optimistic non-destructive catalog sync with read-back verification
        catalog_info = {}
        if title and author:
            try:
                catalog_info = sync_canonical_catalog_with_gdrive(service, title, author, book_folder_name, pub_data)
            except Exception as c_exc:
                catalog_info = {"gdrive_catalog": f"error: {c_exc}"}

        return {
            "status": "uploaded",
            "gdrive_folder_id": book_folder_id,
            "parent_folder_name": "英文经典2",
            "parent_folder_id": GDRIVE_CLASSIC2_FOLDER_ID,
            "catalog_sync": catalog_info,
        }
    except Exception as exc:
        return {"status": "failed", "error": str(exc)}


def fetch(args: argparse.Namespace) -> int:
    # Formal skill use is fail-closed: the canonical completed-books catalog
    # must be checked before any network/download or output-directory mutation.
    if args.completion_catalog is None:
        if not args.allow_without_completion_catalog:
            raise FetchError(
                "completion catalog is required before download; fetch the canonical Drive classics_catalog.json "
                "and pass --completion-catalog, or use --allow-without-completion-catalog only for explicit standalone testing"
            )
    else:
        catalog_path = args.completion_catalog.expanduser().resolve()
        try:
            catalog = registry.load_catalog(catalog_path)
        except registry.RegistryError as exc:
            raise FetchError(f"cannot validate completion catalog: {exc}") from exc
        validation = registry.validate_catalog(catalog)
        if not validation["ok"]:
            raise FetchError("completion catalog is invalid; refusing to download until duplicate IDs/title-author records are resolved")
        completion = registry.check_catalog(catalog, args.title, args.author)
        if completion["status"] == "completed":
            result = {
                "schema_version": VERSION,
                "skill_version": SKILL_VERSION,
                "status": "already-completed",
                "title": args.title,
                "author": args.author,
                "completion_catalog": str(catalog_path),
                "catalog_match": completion["match"],
                "match_method": completion["match_method"],
            }
            print(json_dump(result), end="")
            return 0
        if completion["status"] == "ambiguous":
            raise FetchError(
                "completion catalog has a same-slug different-author conflict for this title; manual resolution is required before download"
            )

    raw_out = args.out.expanduser()
    if args.force and raw_out.is_symlink():
        raise FetchError(f"refusing --force through symbolic-link output path: {raw_out}")
    out_dir = raw_out.resolve()
    if out_dir.exists() and any(out_dir.iterdir()) and not args.force:
        raise FetchError(f"output directory is not empty: {out_dir}; use --force to replace")
    if out_dir.exists() and args.force:
        assert_safe_force_directory(out_dir)
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    attempts: list[dict[str, Any]] = []
    source: dict[str, Any] | None = None

    if not args.skip_standardebooks:
        try:
            source = try_standardebooks(args.title, args.author, out_dir, args.timeout)
            attempts.append({"provider": "standardebooks", "status": "selected" if source else "not-found"})
        except FetchError as exc:
            attempts.append({"provider": "standardebooks", "status": "failed", "error": str(exc)})

    if source is None:
        # Keep raw failed-attempt artifacts for diagnostics, but never let a
        # partial Standard Ebooks working file/assets contaminate Gutenberg.
        reset_working_derivatives(out_dir)
        try:
            source = try_gutenberg(args.title, args.author, out_dir, args.timeout, args.gutenberg_mirror)
            attempts.append({"provider": "project-gutenberg", "status": "selected" if source else "not-found"})
        except FetchError as exc:
            attempts.append({"provider": "project-gutenberg", "status": "failed", "error": str(exc)})

    if source is None:
        manifest = {
            "schema_version": VERSION,
            "skill_version": SKILL_VERSION,
            "title": args.title,
            "author": args.author,
            "status": "not-found",
            "attempts": attempts,
            "runtime_dependencies": [],
        }
        atomic_write_text(out_dir / "source_manifest.json", json_dump(manifest))
        raise FetchError("no acceptable Standard Ebooks or Project Gutenberg source was found")

    # Step 1: Write initial source_manifest.json into out_dir BEFORE upload
    manifest = {
        "schema_version": VERSION,
        "skill_version": SKILL_VERSION,
        "title": args.title,
        "author": args.author,
        "status": "ready",
        "selection_policy": [
            "standardebooks-public-git-xhtml",
            "gutendex-gutenberg-html-via-mirror",
            "gutendex-gutenberg-utf8-text-via-mirror",
            "gutenberg-generated-mirror-fallback",
        ],
        "project_gutenberg_main_site_automation": False,
        "runtime_dependencies": [],
        "attempts": attempts,
        "selected": source,
    }
    manifest_path = out_dir / "source_manifest.json"
    atomic_write_text(manifest_path, json_dump(manifest))

    # Step 2: Upload entire out_dir (which now includes source_manifest.json, working_source.html, raw/, assets/)
    gdrive_sync = upload_book_to_gdrive(out_dir, args.title, args.author)
    manifest["gdrive_sync"] = gdrive_sync

    # Step 3: Update local source_manifest.json with gdrive_sync status
    atomic_write_text(manifest_path, json_dump(manifest))
    print(json_dump(manifest), end="")
    return 0


def localize_local_html_assets(document: str, source_path: Path, out_dir: Path) -> tuple[str, dict[str, Any]]:
    """Copy relative media references that resolve inside the local source tree."""
    attr_re = re.compile(
        r"(?P<prefix>\b(?:src|poster)\s*=\s*)(?P<quote>[\"'])(?P<url>.*?)(?P=quote)",
        re.I,
    )
    source_root = source_path.parent.resolve()
    assets_dir = out_dir / "assets"
    replacements: dict[str, str] = {}
    copied: list[dict[str, Any]] = []
    unresolved: list[str] = []
    refs: list[str] = []
    for match in attr_re.finditer(document):
        value = html.unescape(match.group("url")).strip()
        if value and value not in refs:
            refs.append(value)
    for value in refs:
        parsed = urllib.parse.urlparse(value)
        compact = re.sub(r"[\x00-\x20]+", "", value).lower()
        if parsed.scheme or parsed.netloc or value.startswith(("#", "/")) or compact.startswith(("data:", "javascript:", "vbscript:")):
            continue
        candidate = (source_root / urllib.parse.unquote(parsed.path)).resolve()
        try:
            relative = candidate.relative_to(source_root)
        except ValueError:
            unresolved.append(value)
            continue
        if not candidate.is_file():
            unresolved.append(value)
            continue
        target = assets_dir / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(candidate, target)
        new_url = "assets/" + relative.as_posix()
        if parsed.query:
            new_url += "?" + parsed.query
        if parsed.fragment:
            new_url += "#" + parsed.fragment
        replacements[value] = new_url
        data = target.read_bytes()
        copied.append({
            "source_file": str(candidate),
            "local_file": str(target),
            "sha256": sha256_bytes(data),
            "bytes": len(data),
        })

    def replace(match: re.Match[str]) -> str:
        original = html.unescape(match.group("url")).strip()
        replacement = replacements.get(original)
        if replacement is None:
            return match.group(0)
        return f"{match.group('prefix')}{match.group('quote')}{html.escape(replacement, quote=True)}{match.group('quote')}"

    return attr_re.sub(replace, document), {
        "copied": copied,
        "unresolved_relative_media": unresolved,
        "assets_dir": str(assets_dir.resolve()) if copied else None,
    }


def normalize_local(args: argparse.Namespace) -> int:
    source_path = args.input.expanduser().resolve()
    if not source_path.is_file():
        raise FetchError(f"local source does not exist: {source_path}")
    raw_out = args.out.expanduser()
    if args.force and raw_out.is_symlink():
        raise FetchError(f"refusing --force through symbolic-link output path: {raw_out}")
    out_dir = raw_out.resolve()
    if out_dir.exists() and any(out_dir.iterdir()) and not args.force:
        raise FetchError(f"output directory is not empty: {out_dir}; use --force to replace")
    if out_dir.exists() and args.force:
        assert_safe_force_directory(out_dir, protected_paths=(source_path,))
        shutil.rmtree(out_dir)
    raw_dir = out_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    raw_path = raw_dir / source_path.name
    raw_bytes = source_path.read_bytes()
    atomic_write_bytes(raw_path, raw_bytes)
    suffix = source_path.suffix.lower()
    title = args.title or source_path.stem
    author = args.author or "Unknown"
    working_path = out_dir / "working_source.html"
    local_asset_info: dict[str, Any] | None = None
    text_normalization_info: dict[str, Any] | None = None
    if suffix in {".html", ".htm", ".xhtml"}:
        source_text = decode_text_bytes(raw_bytes)
        working, local_asset_info = localize_local_html_assets(source_text, source_path, out_dir)
        source_format = "html-local"
        boilerplate = {"removed": False, "method": "none"}
    elif suffix in {".txt", ".text"}:
        source_text = decode_text_bytes(raw_bytes)
        payload, boilerplate = strip_gutenberg_text_boilerplate(source_text) if args.strip_gutenberg_boilerplate else (source_text, {"removed": False, "method": "disabled"})
        working, text_normalization_info = plain_text_to_html_with_info(payload, title, author, args.lang)
        source_format = "text-derived-html"
    else:
        raise FetchError("local normalize currently accepts .html/.htm/.xhtml/.txt; reacquire Markdown editions from the original source when possible")
    atomic_write_text(working_path, working)
    manifest = {
        "schema_version": VERSION,
        "skill_version": SKILL_VERSION,
        "title": title,
        "author": author,
        "status": "ready",
        "selection_policy": ["local-source-normalization"],
        "runtime_dependencies": [],
        "selected": {
            "provider": "local",
            "priority": 0,
            "raw_source": str(raw_path),
            "raw_source_sha256": sha256_file(raw_path),
            "working_source": str(working_path),
            "working_source_sha256": sha256_file(working_path),
            "source_format": source_format,
            "language": args.lang,
            "boilerplate": boilerplate,
            "text_normalization": text_normalization_info,
            "assets_dir": (local_asset_info or {}).get("assets_dir"),
            "asset_files": directory_inventory(out_dir / "assets"),
            "asset_localization": local_asset_info,
        },
    }
    atomic_write_text(out_dir / "source_manifest.json", json_dump(manifest))
    print(json_dump(manifest), end="")
    return 0

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Acquire structured public-domain ebook sources for local use")
    sub = parser.add_subparsers(dest="command", required=True)
    fetch_p = sub.add_parser("fetch", help="find and download the best available source")
    fetch_p.add_argument("--title", required=True)
    fetch_p.add_argument("--author", required=True)
    fetch_p.add_argument("--out", type=Path, required=True)
    fetch_p.add_argument("--timeout", type=int, default=30)
    fetch_p.add_argument("--gutenberg-mirror", default=DEFAULT_GUTENBERG_MIRROR)
    fetch_p.add_argument("--skip-standardebooks", action="store_true")
    fetch_p.add_argument("--completion-catalog", type=Path, help="fresh local copy of the canonical completed-books classics_catalog.json")
    fetch_p.add_argument(
        "--allow-without-completion-catalog", action="store_true",
        help="explicit standalone/testing override; formal skill runs must not use this",
    )
    fetch_p.add_argument("--force", action="store_true")
    fetch_p.set_defaults(func=fetch)

    local_p = sub.add_parser("normalize", help="normalize a local HTML/XHTML/TXT source to working_source.html")
    local_p.add_argument("input", type=Path)
    local_p.add_argument("--out", type=Path, required=True)
    local_p.add_argument("--title")
    local_p.add_argument("--author")
    local_p.add_argument("--lang", choices=["en", "sw"], default="en")
    local_p.add_argument("--strip-gutenberg-boilerplate", action="store_true")
    local_p.add_argument("--force", action="store_true")
    local_p.set_defaults(func=normalize_local)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    if hasattr(args, "timeout") and args.timeout <= 0:
        parser.error("--timeout must be positive")
    if getattr(args, "command", None) == "fetch":
        if not args.title.strip() or not args.author.strip():
            parser.error("--title and --author must contain non-whitespace text")
        mirror = urllib.parse.urlparse(args.gutenberg_mirror)
        if mirror.scheme not in {"http", "https"} or not mirror.netloc:
            parser.error("--gutenberg-mirror must be an http(s) URL with a host")
    try:
        return args.func(args)
    except (FetchError, OSError, UnicodeError, ET.ParseError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
