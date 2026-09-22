#!/usr/bin/env python3
"""
split_release_shadow.py — split _release_shadow/ into _release_shadow_en/
and _release_shadow_sw/ so the upload pipeline can run twice in order:
    round 1: en only   -> original books created
    round 2: sw only   -> translations attached via translationOfSlug

Same chapter-heading fixes that prep_release_shadow.py already wrote are
preserved because we just symlink/project the same files.
"""
import shutil
from pathlib import Path

ROOT = Path("/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文/正文")
SHADOW = ROOT / "_release_shadow"
SHADOW_EN = ROOT / "_release_shadow_en"
SHADOW_SW = ROOT / "_release_shadow_sw"


def build():
    for d in (SHADOW_EN, SHADOW_SW):
        if d.exists():
            shutil.rmtree(d)
        d.mkdir(parents=True, exist_ok=True)
    for src in sorted(SHADOW.glob("*_project")):
        for sub in src.iterdir():
            if not sub.is_dir() or sub.name not in {"en", "sw"}:
                continue
            dst = (SHADOW_EN if sub.name == "en" else SHADOW_SW) / src.name / sub.name
            dst.mkdir(parents=True, exist_ok=True)
            for f in sub.iterdir():
                if f.is_file():
                    shutil.copy2(f, dst / f.name)
    print(f"✅ EN: {sum(1 for _ in SHADOW_EN.glob('*_project'))} books")
    print(f"✅ SW: {sum(1 for _ in SHADOW_SW.glob('*_project'))} books")


if __name__ == "__main__":
    build()