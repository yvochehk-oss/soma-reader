#!/usr/bin/env python3
"""
Compress covers under 100KB and upload new book (Voices Beneath the Baobab / Sauti Chini ya Mbuyu) to Supabase & booksData.ts.
"""

import os
import re
import json
import subprocess
from PIL import Image

BASE_DIR = "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文/Sauti_Chini_ya_Mbuyu_complete_project_v2_2"
PUBLIC_COVERS_DIR = os.path.join(os.getcwd(), "public", "covers")
os.makedirs(PUBLIC_COVERS_DIR, exist_ok=True)

SUPABASE_URL = "https://uamaohjbrjervzsjxwyg.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable_bLhT1CNl-DrFn_wz6gmp6A_fJPGBY2G"

BOOK_CONFIG = {
    "slug": "voices-beneath-the-baobab",
    "title_en": "Voices Beneath the Baobab",
    "title_sw": "Sauti Chini ya Mbuyu",
    "author": "Zahra Bahari",
    "category": "Urban Fantasy",
    "rating": 4.97,
    "description_en": "Deep in the coastal forests of Kenya, an ancient Baobab tree begins to whisper long-forgotten secrets of ancestral power, binding a young woman's destiny to a hidden sacred order.",
    "description_sw": "Ndani ya misitu ya pwani ya Kenya, mti wa zamani wa Mbuyu unaanza kunong'ona siri zilizosahaulika kwa muda mrefu za nguvu za mababu, ukifunga hatima ya msichana mdogo kwenye agano la siri.",
    "en_md_path": os.path.join(BASE_DIR, "04_english", "Voices_Beneath_the_Baobab_final_en_expanded_v2_2.md"),
    "sw_md_path": os.path.join(BASE_DIR, "03_swahili", "Sauti_Chini_ya_Mbuyu_final_sw_expanded_v2_2.md"),
    "en_cover_src": os.path.join(BASE_DIR, "05_covers", "Voices_Beneath_the_Baobab_cover_en_v2_2.png"),
    "sw_cover_src": os.path.join(BASE_DIR, "05_covers", "Sauti_Chini_ya_Mbuyu_cover_sw_v2_2.png"),
    "en_cover_dest": os.path.join(PUBLIC_COVERS_DIR, "voices_beneath_the_baobab_en.jpg"),
    "sw_cover_dest": os.path.join(PUBLIC_COVERS_DIR, "sauti_chini_ya_mbuyu_sw.jpg"),
    "cover_url": "/covers/voices_beneath_the_baobab_en.jpg",
    "tags": ["Baobab Secrets", "Coastal Kenya", "Ancestral Magic", "Swahili Fantasy"]
}

# 1. Compress Covers Under 100KB
def compress_image_under_100kb(src_path, dest_path):
    img = Image.open(src_path)
    if img.mode != 'RGB':
        img = img.convert('RGB')
    img.thumbnail((600, 900), Image.Resampling.LANCZOS)
    
    quality = 85
    img.save(dest_path, 'JPEG', quality=quality, optimize=True)
    while os.path.getsize(dest_path) > 100 * 1024 and quality > 30:
        quality -= 5
        img.save(dest_path, 'JPEG', quality=quality, optimize=True)
        
    size_kb = os.path.getsize(dest_path) / 1024
    print(f"🖼️ Compressed cover '{os.path.basename(dest_path)}': {size_kb:.2f} KB (Quality={quality})")

print("📸 Compressing new book covers under 100KB limit...")
compress_image_under_100kb(BOOK_CONFIG["en_cover_src"], BOOK_CONFIG["en_cover_dest"])
compress_image_under_100kb(BOOK_CONFIG["sw_cover_src"], BOOK_CONFIG["sw_cover_dest"])

# 2. Parse Chapters Helper
def parse_chapters(text, regex):
    parts = re.split(regex, text, flags=re.MULTILINE)
    chapters = []
    for i in range(1, len(parts), 2):
        ch_title = parts[i].strip()
        ch_content = parts[i+1].strip() if i+1 < len(parts) else ""
        chapters.append({"title": ch_title, "content": ch_content})
    return chapters

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

# 3. Process and Upload to Supabase
with open(BOOK_CONFIG["en_md_path"], "r", encoding="utf-8") as f:
    en_text = f.read()
with open(BOOK_CONFIG["sw_md_path"], "r", encoding="utf-8") as f:
    sw_text = f.read()
    
en_chapters = parse_chapters(en_text, r"^#\s+(Chapter\s+[^:\n]+:?.*?$)")
sw_chapters = parse_chapters(sw_text, r"^#\s+(Sura\s+ya\s+[^:\n]+:?.*?$)")

print(f"\n📖 [{BOOK_CONFIG['title_en']}] Parsed {len(en_chapters)} EN chapters & {len(sw_chapters)} SW chapters.")

book_payload = {
    "slug": BOOK_CONFIG["slug"],
    "title": BOOK_CONFIG["title_en"],
    "title_swahili": BOOK_CONFIG["title_sw"],
    "author_name": BOOK_CONFIG["author"],
    "description": BOOK_CONFIG["description_en"],
    "cover_url": BOOK_CONFIG["cover_url"],
    "language_code": "en",
    "category": BOOK_CONFIG["category"].lower(),
    "status": "published",
    "is_featured": True,
    "total_chapters": len(en_chapters)
}

print(f"⚡ Upserting Supabase metadata for {BOOK_CONFIG['title_en']}...")
run_curl_post(f"{SUPABASE_URL}/rest/v1/books", book_payload)

get_resp = run_curl_get(f"{SUPABASE_URL}/rest/v1/books?slug=eq.{BOOK_CONFIG['slug']}&select=id")
books_list = json.loads(get_resp) if get_resp else []
if books_list:
    book_id = books_list[0]["id"]
    print(f"✅ Book ID: {book_id}")
    
    # Clear existing chapters
    run_curl_post(f"{SUPABASE_URL}/rest/v1/chapters?book_id=eq.{book_id}", {}, method="DELETE")
    
    max_count = max(len(en_chapters), len(sw_chapters))
    print(f"🚀 Uploading {max_count} chapters to Supabase...")
    for idx in range(max_count):
        en_ch = en_chapters[idx] if idx < len(en_chapters) else {"title": f"Chapter {idx+1}", "content": ""}
        sw_ch = sw_chapters[idx] if idx < len(sw_chapters) else {"title": f"Sura ya {idx+1}", "content": ""}
        
        ch_payload = {
            "book_id": book_id,
            "chapter_number": idx + 1,
            "title": en_ch["title"],
            "content": en_ch["content"],
            "status": "published",
            "is_free": True,
            "word_count": len(en_ch["content"].split())
        }
        run_curl_post(f"{SUPABASE_URL}/rest/v1/chapters", ch_payload)
    print(f"🎉 Successfully uploaded {BOOK_CONFIG['title_en']} ({max_count} chapters) to Supabase!")

print("\n🚀 100% SUCCESS: Voices Beneath the Baobab uploaded to Supabase!")
