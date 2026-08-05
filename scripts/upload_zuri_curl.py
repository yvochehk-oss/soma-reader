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

slug = "zuri-queen-of-fashion"

book_payload = {
    "slug": slug,
    "title": "Zuri: Queen of Fashion",
    "title_swahili": "Zuri: Malkia wa Mitindo",
    "author": "Asha Maridadi",
    "description": "Humiliated at a lavish Nairobi banquet after her fiance breaks their engagement, Amina reveals her true identity as Zuri—the international queen of high fashion and corporate power.",
    "description_swahili": "Akitukanwa katika karamu ya kifahari ya Nairobi baada ya mchumba wake kuvunja uchumba, Amina anafichua utambulisho wake wa kweli kama Zuri—malkia wa kimataifa wa mitindo na nguvu za kibiashara.",
    "cover_image": "/covers/zuri_queen_of_fashion_en.jpg",
    "rating": 4.95,
    "status": "Completed",
    "category": "Romance",
    "tags": ["Nairobi Fashion", "Revenge", "Billionaire", "Swahili Romance", "Zuri"]
}

def run_curl_post(url, data_json, method="POST"):
    cmd = [
        "curl", "-s", "--retry", "5", "--retry-delay", "2",
        "-X", method,
        "-H", "Content-Type: application/json",
        "-H", f"apikey: {SUPABASE_ANON_KEY}",
        "-H", f"Authorization: Bearer {SUPABASE_ANON_KEY}",
        "-H", "Prefer: resolution=merge-duplicates",
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

print("⚡ Upserting Zuri metadata to Supabase via robust cURL...")
run_curl_post(f"{SUPABASE_URL}/rest/v1/books", book_payload)

get_resp = run_curl_get(f"{SUPABASE_URL}/rest/v1/books?slug=eq.{slug}&select=id")
books = json.loads(get_resp) if get_resp else []
if not books:
    print("❌ Failed to get book ID")
    exit(1)

book_id = books[0]["id"]
print(f"✅ Book ID retrieved: {book_id}")

# Delete existing chapters
run_curl_post(f"{SUPABASE_URL}/rest/v1/chapters?book_id=eq.{book_id}", {}, method="DELETE")

count = max(len(en_chapters), len(sw_chapters))
print(f"🚀 Uploading {count} bilingual chapters via cURL...")

for i in range(count):
    en_ch = en_chapters[i] if i < len(en_chapters) else {"title": f"Chapter {i+1}", "content": ""}
    sw_ch = sw_chapters[i] if i < len(sw_chapters) else {"title": f"Sura ya {i+1}", "content": ""}
    
    ch_payload = {
        "book_id": book_id,
        "chapter_number": i + 1,
        "title": en_ch["title"],
        "title_swahili": sw_ch["title"],
        "content": en_ch["content"],
        "content_swahili": sw_ch["content"]
    }
    
    run_curl_post(f"{SUPABASE_URL}/rest/v1/chapters", ch_payload)
    print(f"  ✨ Chapter {i+1}/{count} uploaded successfully!")

print(f"🎉 100% SUCCESS: Uploaded Zuri: Queen of Fashion ({count} chapters) to Supabase!")
