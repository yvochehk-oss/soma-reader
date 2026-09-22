#!/usr/bin/env python3
"""
strip_en_translation_field.py — for each *_project/en/story_meta.json,
drop the translation_of_slug field. The upload pipeline treats the en
volume as the parent and sets translationOfSlug on the sw side
automatically; an en self-reference only triggers "translationOfSlug does
not match an existing original book" errors.

Run after settle_project_dirs.py, before prep_release_shadow.py.
"""
import json
from pathlib import Path

ROOT = Path("/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文/正文")

for project in sorted(ROOT.glob("*_project")):
    en_meta = project / "en" / "story_meta.json"
    if not en_meta.exists():
        print(f"⚠  no en meta: {en_meta}")
        continue
    data = json.loads(en_meta.read_text())
    if "translation_of_slug" in data:
        del data["translation_of_slug"]
        en_meta.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
        print(f"✅ stripped: {en_meta.relative_to(ROOT)}")
    else:
        print(f"=  unchanged: {en_meta.relative_to(ROOT)}")