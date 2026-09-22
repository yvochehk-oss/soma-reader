#!/usr/bin/env python3
"""
sw_books_pipeline.py — single CLI for the sw_books_pipeline.db.

Subcommands:
  sync         scan local 正文 folders + handoff/story_meta, write books + assets
  status       pretty-print the current state of every book
  mark-cover   set cover_state=generated on a book (after running cover script)
  mark-sync    set sync_state on a book (after gdrive sync)
  record-release  record a release audit (called by release-soma-books.mjs hook)
  remote-check query somanovel.uk / Supabase for each book and store remote_audits
  schema       print db path + table list
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "sw_books_pipeline.db"
ROOT_POS = Path("/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文/正文")
SCHEMA_PATH = Path(__file__).resolve().parent.parent / "data" / "sw_books_pipeline.sql"
SITE_URL = "https://somanovel.uk"

BOOK_FOLDERS = [
    "2026-08-08_nyumba_isiyouzwa",
    "2026-08-12_kikombe_kisicho_na_shamba",
    "2026-08-12_mgeni_wa_chumba_407",
    "2026-08-12_namba_iliyokufa_mara_mbili",
    "2026-08-13_dawa_ya_usiku",
]


def connect() -> sqlite3.Connection:
    if not DB_PATH.exists():
        sys.exit(f"❌ DB not found: {DB_PATH}. Run `uv run scripts/sw_books_pipeline.py schema` first.")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def sha256_file(path: Path) -> str:
    if not path.exists() or not path.is_file():
        return ""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except Exception:
        return {}


def sync_one_book(conn: sqlite3.Connection, book_id: str) -> dict:
    folder = ROOT_POS / book_id
    if not folder.exists():
        return {"book_id": book_id, "error": "folder not found"}

    sw_md = next(iter(folder.glob("*_sw_final.md")), None)
    en_md = next(iter(folder.glob("*_en_final.md")), None)
    cover_sw = folder / "cover_sw.jpg"
    cover_en = folder / "cover_en.jpg"
    mobile_cover = next(iter(folder.glob("mobile_*_cover.jpg")), None)
    story_meta = folder / "story_meta.json"
    planning = folder / "planning.md"
    handoff = folder / "handoff_status.json"

    meta = _load_json(story_meta)
    handoff_data = _load_json(handoff)
    legacy = _load_json(ROOT_POS / "写作中转" / book_id / "legacy_completion_status.json")

    sw_title = meta.get("title") or (sw_md.stem.replace("_sw_final", "").replace("_", " ").title() if sw_md else book_id)
    en_title = None
    if en_md:
        head = en_md.read_text().splitlines()[:3]
        for line in head:
            if line.startswith("# ") and not line.startswith("# The"):
                pass
            if line.startswith("# ") and "Author" not in line:
                en_title = line[2:].strip()
                break

    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO books (
            book_id, slug, slug_en, title_sw, title_en, author, pool, source_slot,
            run_date, plan_version, handoff_id, handoff_status, language_pair,
            folder_local, folder_remote_gdrive, file_sw_md_id, file_en_md_id,
            file_cover_sw_sha256, file_cover_en_sha256,
            sync_state, cover_state, publish_state, notes, updated_at
        ) VALUES (
            :book_id, :slug, :slug_en, :title_sw, :title_en, :author, :pool, :source_slot,
            :run_date, :plan_version, :handoff_id, :handoff_status, 'sw+en',
            :folder_local, :folder_remote_gdrive, :file_sw_md_id, :file_en_md_id,
            :file_cover_sw_sha256, :file_cover_en_sha256,
            'synced', 'generated', 'unsent', :notes, :updated_at
        )
        ON CONFLICT(book_id) DO UPDATE SET
            slug = excluded.slug,
            slug_en = excluded.slug_en,
            title_sw = excluded.title_sw,
            title_en = excluded.title_en,
            author = excluded.author,
            pool = excluded.pool,
            source_slot = excluded.source_slot,
            run_date = excluded.run_date,
            plan_version = excluded.plan_version,
            handoff_id = excluded.handoff_id,
            handoff_status = excluded.handoff_status,
            folder_local = excluded.folder_local,
            folder_remote_gdrive = excluded.folder_remote_gdrive,
            file_sw_md_id = excluded.file_sw_md_id,
            file_en_md_id = excluded.file_en_md_id,
            file_cover_sw_sha256 = excluded.file_cover_sw_sha256,
            file_cover_en_sha256 = excluded.file_cover_en_sha256,
            sync_state = excluded.sync_state,
            cover_state = excluded.cover_state,
            updated_at = excluded.updated_at
        """,
        {
            "book_id": book_id,
            "slug": meta.get("title") and book_id.split("_", 1)[1].replace("mgeni_", "mgeni-").replace("_", "-") if False else book_id.split("_", 1)[1],
            "slug_en": meta.get("translation_of_slug"),
            "title_sw": sw_title,
            "title_en": meta.get("title_original") or en_title,
            "author": meta.get("author") or handoff_data.get("author") or legacy.get("author") or "Unknown",
            "pool": handoff_data.get("pool") or legacy.get("pool"),
            "source_slot": handoff_data.get("source_slot"),
            "run_date": handoff_data.get("run_date") or legacy.get("run_date"),
            "plan_version": handoff_data.get("plan_version") or legacy.get("origin_plan_version"),
            "handoff_id": handoff_data.get("handoff_id") or legacy.get("book_id"),
            "handoff_status": handoff_data.get("status") or legacy.get("status") or "UNKNOWN",
            "folder_local": str(folder),
            "folder_remote_gdrive": legacy.get("final_folder_id"),
            "file_sw_md_id": legacy.get("sw_final_file_id"),
            "file_en_md_id": legacy.get("en_final_file_id"),
            "file_cover_sw_sha256": sha256_file(cover_sw),
            "file_cover_en_sha256": sha256_file(cover_en),
            "notes": handoff_data.get("compatibility_note") or legacy.get("compatibility_note"),
            "updated_at": datetime.now().isoformat(timespec="seconds"),
        },
    )

    assets = [
        ("sw_final_md", sw_md),
        ("en_final_md", en_md),
        ("cover_sw", cover_sw),
        ("cover_en", cover_en),
        ("mobile_cover", mobile_cover),
        ("story_meta", story_meta),
        ("planning_md", planning),
        ("handoff_status", handoff),
    ]

    for kind, p in assets:
        if not p:
            continue
        cur.execute(
            """
            INSERT INTO assets (
                book_id, asset_kind, path_local, sha256, size_bytes,
                state_local, state_remote, state_qa, last_verified_at, last_verified_by, updated_at
            ) VALUES (?, ?, ?, ?, ?, 'present', 'unknown', 'unknown', ?, 'manual', ?)
            ON CONFLICT(book_id, asset_kind) DO UPDATE SET
                path_local = excluded.path_local,
                sha256 = excluded.sha256,
                size_bytes = excluded.size_bytes,
                state_local = excluded.state_local,
                last_verified_at = excluded.last_verified_at,
                updated_at = excluded.updated_at
            """,
            (book_id, kind, str(p), sha256_file(p), p.stat().st_size if p.exists() else 0,
             datetime.now().isoformat(timespec="seconds"), datetime.now().isoformat(timespec="seconds")),
        )

    conn.commit()
    return {"book_id": book_id, "ok": True}


def cmd_sync(args) -> int:
    conn = connect()
    targets = args.folders or BOOK_FOLDERS
    for book_id in targets:
        result = sync_one_book(conn, book_id)
        ok = "✅" if result.get("ok") else "❌"
        print(f"{ok} {book_id}: {result}")
    conn.close()
    return 0


def cmd_status(args) -> int:
    conn = connect()
    cur = conn.cursor()
    rows = cur.execute(
        """
        SELECT b.book_id, b.title_sw, b.author, b.handoff_status,
               b.sync_state, b.cover_state, b.publish_state,
               b.published_remote_status, b.published_at_remote,
               (SELECT COUNT(*) FROM assets a WHERE a.book_id = b.book_id) AS assets
        FROM books b
        ORDER BY b.run_date, b.book_id
        """
    ).fetchall()
    if not rows:
        print("(no books yet — run `sync` first)")
        return 0
    print(f"{'book_id':<42}  {'author':<18}  {'sync':<8}  {'cover':<10}  {'publish':<10}  {'remote':<10}  {'assets':<6}")
    print("-" * 130)
    for r in rows:
        print(f"{r['book_id']:<42}  {r['author']:<18}  {r['sync_state']:<8}  {r['cover_state']:<10}  {r['publish_state']:<10}  {r['published_remote_status'] or '-':<10}  {r['assets']:<6}")
    conn.close()
    return 0


def cmd_mark_cover(args) -> int:
    conn = connect()
    cur = conn.cursor()
    cur.execute("UPDATE books SET cover_state = 'generated', updated_at = ? WHERE book_id = ?",
                (datetime.now().isoformat(timespec="seconds"), args.book_id))
    conn.commit()
    print(f"✅ {args.book_id}: cover_state = generated")
    conn.close()
    return 0


def cmd_mark_sync(args) -> int:
    conn = connect()
    cur = conn.cursor()
    state = args.state or "synced"
    cur.execute("UPDATE books SET sync_state = ?, updated_at = ? WHERE book_id = ?",
                (state, datetime.now().isoformat(timespec="seconds"), args.book_id))
    conn.commit()
    print(f"✅ {args.book_id}: sync_state = {state}")
    conn.close()
    return 0


def cmd_record_release(args) -> int:
    conn = connect()
    cur = conn.cursor()
    audit = Path(args.audit_json) if args.audit_json else None
    cur.execute(
        """
        INSERT INTO publishes (
            book_id, site_url, mode, audit_json_path, audit_sha256,
            remote_status, remote_chapters, remote_cover_url, remote_slug,
            result, error_message, finished_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (args.book_id, args.site_url or SITE_URL, args.mode,
         str(audit) if audit else None,
         sha256_file(audit) if audit else None,
         args.remote_status, args.remote_chapters, args.remote_cover_url, args.remote_slug,
         args.result, args.error, datetime.now().isoformat(timespec="seconds")),
    )
    cur.execute(
        """
        UPDATE books SET publish_state = ?,
                         published_remote_status = ?,
                         published_at_remote = ?,
                         published_slug = ?,
                         audit_json_path = ?,
                         last_error = ?,
                         updated_at = ?
        WHERE book_id = ?
        """,
        (args.result, args.remote_status, args.finished_at, args.remote_slug,
         str(audit) if audit else None, args.error,
         datetime.now().isoformat(timespec="seconds"), args.book_id),
    )
    conn.commit()
    print(f"✅ recorded release for {args.book_id}: {args.result}")
    conn.close()
    return 0


def cmd_remote_check(args) -> int:
    """Query somanovel.uk book-import for each book and update books + remote_audits."""
    import urllib.request
    import urllib.error
    conn = connect()
    cur = conn.cursor()
    books = cur.execute("SELECT book_id, slug, slug_en FROM books").fetchall()
    for r in books:
        # 双语 slug:sw 用原 slug,en 用 translation_of_slug
        slugs_to_check = [r["slug"], r["slug_en"]] if r["slug_en"] else [r["slug"]]
        for slug in slugs_to_check:
            if not slug:
                continue
            url = f"{SITE_URL}/api/internal/book-import?slug={slug}"
            try:
                with urllib.request.urlopen(url, timeout=8) as resp:
                    payload = resp.read().decode("utf-8", errors="replace")
                    status = "present"
                    chapters = 0
                    cover_url = ""
                    try:
                        data = json.loads(payload)
                        status = data.get("status", "present")
                        chapters = len(data.get("chapters") or []) or data.get("total_chapters", 0)
                        cover_url = data.get("cover_url") or ""
                    except Exception:
                        pass
                    cur.execute(
                        """
                        INSERT INTO remote_audits (book_id, slug, site_url, remote_status,
                                                   remote_chapters, remote_cover_url, remote_response_json, source)
                        VALUES (?, ?, ?, ?, ?, ?, ?, 'book-import')
                        """,
                        (r["book_id"], slug, SITE_URL, status, chapters, cover_url, payload[:4000]),
                    )
                    # 更新 books.published_*
                    cur.execute(
                        """
                        UPDATE books SET published_remote_status = ?,
                                         published_at_remote = ?,
                                         site_url = ?,
                                         updated_at = ?
                        WHERE book_id = ? AND published_slug = ?
                        """,
                        (status, datetime.now().isoformat(timespec="seconds"), SITE_URL,
                         datetime.now().isoformat(timespec="seconds"), r["book_id"], slug),
                    )
                    print(f"  {slug:<35} {status:<10} ch={chapters} cover={bool(cover_url)}")
            except urllib.error.HTTPError as e:
                print(f"  {slug:<35} ❌ HTTP {e.code}")
                cur.execute(
                    """
                    INSERT INTO remote_audits (book_id, slug, site_url, remote_status,
                                               remote_response_json, source)
                    VALUES (?, ?, ?, ?, ?, 'book-import')
                    """,
                    (r["book_id"], slug, SITE_URL, f"http-{e.code}", str(e)[:2000]),
                )
            except Exception as e:
                print(f"  {slug:<35} ❌ {e}")
                cur.execute(
                    """
                    INSERT INTO remote_audits (book_id, slug, site_url, remote_status,
                                               remote_response_json, source)
                    VALUES (?, ?, ?, ?, ?, 'book-import')
                    """,
                    (r["book_id"], slug, SITE_URL, "error", str(e)[:2000]),
                )
    conn.commit()
    conn.close()
    return 0


def cmd_schema(args) -> int:
    print(f"DB: {DB_PATH}")
    if not DB_PATH.exists():
        print("(not yet created)")
        return 0
    conn = connect()
    for t in conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall():
        n = conn.execute(f"SELECT COUNT(*) FROM {t['name']}").fetchone()[0]
        print(f"  {t['name']:<20} {n} rows")
    conn.close()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="sw_books_pipeline CLI")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("sync", help="scan local folders and write books + assets")
    p.add_argument("--folder", dest="folders", action="append", help="specific book_id (repeatable)")
    p.set_defaults(func=cmd_sync)

    sub.add_parser("status", help="print summary table").set_defaults(func=cmd_status)

    p = sub.add_parser("mark-cover", help="mark cover_state=generated")
    p.add_argument("book_id")
    p.set_defaults(func=cmd_mark_cover)

    p = sub.add_parser("mark-sync", help="mark sync_state")
    p.add_argument("book_id")
    p.add_argument("--state", default="synced")
    p.set_defaults(func=cmd_mark_sync)

    p = sub.add_parser("record-release", help="record a release audit row")
    p.add_argument("book_id")
    p.add_argument("--mode", default="production")
    p.add_argument("--result", required=True, choices=["published", "updated", "failed", "skipped"])
    p.add_argument("--audit-json", default=None)
    p.add_argument("--remote-status", default=None)
    p.add_argument("--remote-chapters", type=int, default=None)
    p.add_argument("--remote-cover-url", default=None)
    p.add_argument("--remote-slug", default=None)
    p.add_argument("--finished-at", default=None)
    p.add_argument("--site-url", default=None)
    p.add_argument("--error", default=None)
    p.set_defaults(func=cmd_record_release)

    sub.add_parser("remote-check", help="query somanovel.uk for each book").set_defaults(func=cmd_remote_check)

    sub.add_parser("schema", help="print db path and table counts").set_defaults(func=cmd_schema)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
