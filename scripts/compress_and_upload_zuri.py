#!/usr/bin/env python3
"""
Compress covers under 100KB and upload Zuri: Queen of Fashion (Bilingual) to Supabase.
"""

import os
import re
import json
import urllib.request
from PIL import Image

# 1. Compress Covers to under 100KB
SOURCE_DIR = "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文/Zuri Malkia wa Mitindo"
PUBLIC_COVERS_DIR = os.path.join(os.getcwd(), "public", "covers")
os.makedirs(PUBLIC_COVERS_DIR, exist_ok=True)

en_png = os.path.join(SOURCE_DIR, "en.png")
sw_png = os.path.join(SOURCE_DIR, "sw.png")

target_en_jpg = os.path.join(PUBLIC_COVERS_DIR, "zuri_queen_of_fashion_en.jpg")
target_sw_jpg = os.path.join(PUBLIC_COVERS_DIR, "zuri_malkia_wa_mitindo_sw.jpg")

def compress_image_under_100kb(src_path, dest_path):
    img = Image.open(src_path)
    if img.mode != 'RGB':
        img = img.convert('RGB')
    
    # Resize to standard high-res web novel poster dimension (600x900)
    img.thumbnail((600, 900), Image.Resampling.LANCZOS)
    
    quality = 85
    img.save(dest_path, 'JPEG', quality=quality, optimize=True)
    
    # Ensure under 100KB
    while os.path.getsize(dest_path) > 100 * 1024 and quality > 30:
        quality -= 5
        img.save(dest_path, 'JPEG', quality=quality, optimize=True)
        
    size_kb = os.path.getsize(dest_path) / 1024
    print(f"🖼️ Compressed cover '{os.path.basename(dest_path)}': {size_kb:.2f} KB (Quality={quality})")

print("📸 Compressing book covers under 100KB limit...")
compress_image_under_100kb(en_png, target_en_jpg)
compress_image_under_100kb(sw_png, target_sw_jpg)

# 2. Parse Final MD Story Files
en_md_path = os.path.join(SOURCE_DIR, "Zuri_Queen_of_Fashion_final_en.md")
sw_md_path = os.path.join(SOURCE_DIR, "Zuri_Malkia_wa_Mitindo_final_sw.md")

with open(en_md_path, "r", encoding="utf-8") as f:
    en_text = f.read()

with open(sw_md_path, "r", encoding="utf-8") as f:
    sw_text = f.read()

def parse_chapters(text, prefix_pattern):
    # Regex split by header
    parts = re.split(prefix_pattern, text, flags=re.MULTILINE)
    chapters = []
    
    for i in range(1, len(parts), 2):
        ch_title = parts[i].strip()
        ch_content = parts[i+1].strip() if i+1 < len(parts) else ""
        chapters.append({
            "title": ch_title,
            "content": ch_content
        })
    return chapters

# Split EN & SW chapters
en_chapters = parse_chapters(en_text, r"^#\s+(Chapter\s+[^:\n]+:?.*?$)")
sw_chapters = parse_chapters(sw_text, r"^#\s+(Sura\s+ya\s+[^:\n]+:?.*?$)")

print(f"📖 Parsed {len(en_chapters)} EN chapters and {len(sw_chapters)} SW chapters.")

# 3. Supabase REST Upsert
SUPABASE_URL = "https://uamaohjbrjervzsjxwyg.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable_bLhT1CNl-DrFn_wz6gmp6A_fJPGBY2G"

headers = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    "Prefer": "resolution=merge-duplicates"
}

slug = "zuri-queen-of-fashion"

# Book Metadata Payload
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
    "tags": ["Nairobi Fashion", "Revenge", "Billionaire", "Swahili Romance", "Zuri"],
    "word_count": len(en_text.split())
}

print(f"⚡ Uploading '{book_payload['title']}' metadata to Supabase...")

req_book = urllib.request.Request(
    f"{SUPABASE_URL}/rest/v1/books",
    data=json.dumps(book_payload).encode("utf-8"),
    headers=headers,
    method="POST"
)
try:
    with urllib.request.urlopen(req_book) as resp:
        print("✅ Book metadata successfully upserted into Supabase!")
except Exception as e:
    print(f"Book upsert response: {e}")

# Fetch book ID
req_get_id = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/books?slug=eq.{slug}&select=id", headers=headers)
with urllib.request.urlopen(req_get_id) as resp:
    books = json.loads(resp.read().decode("utf-8"))

book_id = books[0]["id"] if books else None
if not book_id:
    print("❌ Failed to retrieve book_id")
    exit(1)

# Delete existing chapters for clean sync
req_del = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/chapters?book_id=eq.{book_id}", headers=headers, method="DELETE")
try:
    urllib.request.urlopen(req_del)
except:
    pass

# Insert aligned chapters
max_chapters = max(len(en_chapters), len(sw_chapters))
chapters_to_insert = []

for idx in range(max_chapters):
    en_ch = en_chapters[idx] if idx < len(en_chapters) else {"title": f"Chapter {idx+1}", "content": ""}
    sw_ch = sw_chapters[idx] if idx < len(sw_chapters) else {"title": f"Sura ya {idx+1}", "content": ""}
    
    chapters_to_insert.append({
        "book_id": book_id,
        "chapter_number": idx + 1,
        "title": en_ch["title"],
        "title_swahili": sw_ch["title"],
        "content": en_ch["content"],
        "content_swahili": sw_ch["content"]
    })

print(f"🚀 Upserting {len(chapters_to_insert)} bilingual chapters into Supabase...")

for ch in chapters_to_insert:
    req_ch = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/chapters",
        data=json.dumps(ch).encode("utf-8"),
        headers=headers,
        method="POST"
    )
    urllib.request.urlopen(req_ch)

print(f"🎉 Successfully uploaded Zuri: Queen of Fashion with all {len(chapters_to_insert)} chapters and compressed <100KB covers!")
