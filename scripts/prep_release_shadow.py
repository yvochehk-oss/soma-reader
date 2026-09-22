#!/usr/bin/env python3
"""
prep_release_shadow.py — build a release-safe shadow of 正文/ for the
upload-soma-books.mjs pipeline.

Why: upload's chapter heading parser treats ANY ':' as the number/title
separator, so "## Sura ya 11 — Entry ya Saa 02:13" is misread as
numText="11 — Entry ya Saa 02" and dropped.

This script copies 正文/ → 正文/_release_shadow/ and rewrites those
specific headings to use '.' instead of ':' in the title's trailing
time stamps. Originals are never touched.

Run once per release batch. The shadow tree maps 1:1 to project dirs so
the upload auto-pairs sw/en seamlessly.
"""
import re
import shutil
from pathlib import Path

ROOT = Path("/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文/正文")
SHADOW = ROOT / "_release_shadow"
HEADING_RE = re.compile(
    r"^(##\s+(?:Sura ya|Chapter)\s+\d+\s+[—\-]\s+)(.+?)$",
    re.MULTILINE,
)


def safe_title(title: str) -> str:
    # Replace any ':' or '：' with '.' only in trailing time-stamp substrings
    return re.sub(r"(\d):(\d)", r"\1.\2", title)


def rewrite(text: str) -> str:
    def sub(m):
        return m.group(1) + safe_title(m.group(2))

    return HEADING_RE.sub(sub, text)


def build():
    if SHADOW.exists():
        shutil.rmtree(SHADOW)
    SHADOW.mkdir(parents=True, exist_ok=True)
    # Only the canonical `2026-08-xx_*_project` (date-prefixed) dirs get in.
    # Bare `*_project` dirs are deprecated legacy — skip.
    for src in ROOT.iterdir():
        if src == SHADOW or src.name == "写作中转":
            continue
        if not src.is_dir():
            continue
        if not src.name.endswith("_project"):
            continue
        if not src.name.startswith("20"):  # date prefix guard
            continue
        dst = SHADOW / src.name
        shutil.copytree(src, dst, dirs_exist_ok=True)
        for f in dst.rglob("*.md"):
            if f.is_file():
                txt = f.read_text()
                new = rewrite(txt)
                if new != txt:
                    f.write_text(new)
                    print(f"  patched: {f.relative_to(SHADOW)}")
    print(f"✅ shadow root: {SHADOW}")
    print(f"   books: {sum(1 for p in SHADOW.glob('*_project'))}")


if __name__ == "__main__":
    build()
