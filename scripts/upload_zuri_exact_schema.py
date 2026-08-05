#!/usr/bin/env python3
import os
import re
import json
import subprocess

SUPABASE_URL = "https://uamaohjbrjervzsjxwyg.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable_bLhT1CNl-DrFn_wz6gmp6A_fJPGBY2G"

SOURCE_DIR = "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文/Zuri Malkia wa Mitindo"
en_md_path = os.path.join(SOURCE_DIR, "Zuri_Queen_of_Fashion_final_en.md")
sw_md_path = os.path.join(SOURCE_DIR, "Zuri_Malkia_wa_Mitindo_final_sw.md")

with open(en_md_path, "r", encoding="utf-8") as f:
    en_text = f.read()

with open(sw_md_path, "r", encoding="utf-8") as f:
    sw_text = f.read()

def parse_chapters(text, regex):
    parts = re.split(regex, text, flags=re.MULTILINE)
    chapters = []
    for i in range(1, len(parts), 2):
        ch_title = parts[i].strip()
        ch_content = parts[i+1].strip() if i+1 < len(parts) else ""
        chapters.append({"title": ch_title, "content": ch_content})
    return chapters

en_chapters = parse_chapters(en_text, r"^#\s+(Chapter\s+[^:\n]+:?.*?$)")
sw_chapters = parse_chapters(sw_text, r"^#\s+(Sura\s+ya\s+[^:\n]+:?.*?$)")

print(f"📖 Parsed {len(en_chapters)} EN chapters & {len(sw_chapters)} SW chapters.")

def run_curl_post(url, data_json, method="POST"):
    cmd = [
        "curl", "-s", "--retry", "5", "--retry-delay", "2",
        "-X", method,
        "-H", "Content-Type: application/json",
        "-H", f"apikey: {SUPABASE_ANON_KEY}",
        "-H", f"Authorization: Bearer {SUPABASE_ANON_KEY}",
        "-H", "Prefer: return=representation",
        "-d", json.dumps(data_json),
        url
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    return res.stdout

def run_curl_get(url):
    cmd = [
        "curl", "-s", "--retry", "5", "--retry-delay", "2",
        "-H", f"apikey: {SUPABASE_ANON_KEY}",
        "-H", f"Authorization: Bearer {SUPABASE_ANON_KEY}",
        url
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    return res.stdout

# 1. Upload English Book Entry
en_slug = "zuri-queen-of-fashion"
en_book_payload = {
    "slug": en_slug,
    "title": "Zuri: Queen of Fashion",
    "author_name": "Asha Maridadi",
    "description": "Humiliated at a lavish Nairobi banquet after her fiance breaks their engagement, Amina reveals her true identity as Zuri—the international queen of high fashion and corporate power.",
    "cover_url": "/covers/zuri_queen_of_fashion_en.jpg",
    "language_code": "en",
    "category": "romance",
    "status": "published",
    "is_featured": True,
    "total_chapters": len(en_chapters)
}

print("⚡ Uploading EN Book Metadata...")
en_resp = run_curl_post(f"{SUPABASE_URL}/rest/v1/books", en_book_payload)
en_books = json.loads(run_curl_get(f"{SUPABASE_URL}/rest/v1/books?slug=eq.{en_slug}&select=id"))
en_book_id = en_books[0]["id"] if en_books else None

if en_book_id:
    print(f"✅ EN Book ID: {en_book_id}. Uploading {len(en_chapters)} EN chapters...")
    run_curl_post(f"{SUPABASE_URL}/rest/v1/chapters?book_id=eq.{en_book_id}", {}, method="DELETE")
    for idx, ch in enumerate(en_chapters, start=1):
        ch_payload = {
            "book_id": en_book_id,
            "chapter_number": idx,
            "title": ch["title"],
            "content": ch["content"],
            "status": "published",
            "is_free": True,
            "word_count": len(ch["content"].split())
        }
        run_curl_post(f"{SUPABASE_URL}/rest/v1/chapters", ch_payload)
    print("🎉 All EN chapters uploaded successfully!")

# 2. Upload Swahili Book Entry
sw_slug = "zuri-malkia-wa-mitindo"
sw_book_payload = {
    "slug": sw_slug,
    "title": "Zuri: Malkia wa Mitindo",
    "author_name": "Asha Maridadi",
    "description": "Akitukanwa katika karamu ya kifahari ya Nairobi baada ya mchumba wake kuvunja uchumba, Amina anafichua utambulisho wake wa kweli kama Zuri—malkia wa kimataifa wa mitindo na nguvu za kibiashara.",
    "cover_url": "/covers/zuri_malkia_wa_mitindo_sw.jpg",
    "language_code": "sw",
    "category": "romance",
    "status": "published",
    "is_featured": True,
    "parent_book_id": en_book_id,
    "total_chapters": len(sw_chapters)
}

print("⚡ Uploading SW Book Metadata...")
sw_resp = run_curl_post(f"{SUPABASE_URL}/rest/v1/books", sw_book_payload)
sw_books = json.loads(run_curl_get(f"{SUPABASE_URL}/rest/v1/books?slug=eq.{sw_slug}&select=id"))
sw_book_id = sw_books[0]["id"] if sw_books else None

if sw_book_id:
    print(f"✅ SW Book ID: {sw_book_id}. Uploading {len(sw_chapters)} SW chapters...")
    run_curl_post(f"{SUPABASE_URL}/rest/v1/chapters?book_id=eq.{sw_book_id}", {}, method="DELETE")
    for idx, ch in enumerate(sw_chapters, start=1):
        ch_payload = {
            "book_id": sw_book_id,
            "chapter_number": idx,
            "title": ch["title"],
            "content": ch["content"],
            "status": "published",
            "is_free": True,
            "word_count": len(ch["content"].split())
        }
        run_curl_post(f"{SUPABASE_URL}/rest/v1/chapters", ch_payload)
    print("🎉 All SW chapters uploaded successfully!")

print("🚀 100% COMPLETE: Zuri (EN & SW) uploaded to Supabase database!")
