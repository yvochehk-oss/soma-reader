#!/usr/bin/env python3
"""
settle_project_dirs.py — sync 正文/<book>/ → 正文/<book>_project/{sw,en}/

For each of the 5 books, ensure *_project/sw/ and *_project/en/ contain
the latest *_final.md, story_meta.json, and cover_{sw,en}.jpg.

This is the layout the upload-soma-books.mjs auto-pairs.
"""
import shutil
from pathlib import Path

ROOT = Path("/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文/正文")
BOOKS = [
    "2026-08-08_nyumba_isiyouzwa",
    "2026-08-12_kikombe_kisicho_na_shamba",
    "2026-08-12_mgeni_wa_chumba_407",
    "2026-08-12_namba_iliyokufa_mara_mbili",
    "2026-08-13_dawa_ya_usiku",
]


def settle(book_id: str):
    src = ROOT / book_id
    project = ROOT / f"{book_id}_project"
    sw_dir = project / "sw"
    en_dir = project / "en"
    sw_dir.mkdir(parents=True, exist_ok=True)
    en_dir.mkdir(parents=True, exist_ok=True)

    sw_md = src / f"{book_id.replace(f'{book_id.split('_')[0]}_', '')}_sw_final.md"
    en_md = src / f"{book_id.replace(f'{book_id.split('_')[0]}_', '')}_en_final.md"
    sw_cover = src / "cover_sw.jpg"
    en_cover = src / "cover_en.jpg"
    meta = src / "story_meta.json"

    pairs = [
        (sw_md, sw_dir / sw_md.name),
        (en_md, en_dir / en_md.name),
        (sw_cover, sw_dir / "cover_sw.jpg"),
        (en_cover, en_dir / "cover_en.jpg"),
        (meta, sw_dir / "story_meta.json"),
        (meta, en_dir / "story_meta.json"),
    ]
    log = []
    for src_p, dst_p in pairs:
        if not src_p.exists():
            log.append(f"⚠  missing source: {src_p}")
            continue
        if dst_p.exists() and dst_p.read_bytes() == src_p.read_bytes():
            log.append(f"= unchanged: {dst_p.relative_to(ROOT)}")
            continue
        shutil.copy2(src_p, dst_p)
        log.append(f"✅ copied → {dst_p.relative_to(ROOT)}")
    print(f"\n📚 {book_id}")
    for line in log:
        print("   " + line)


for b in BOOKS:
    settle(b)
print("\nDone.")
