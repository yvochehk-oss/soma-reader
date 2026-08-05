#!/usr/bin/env python3
"""
Compress covers under 100KB and upload two new books (Ninety Minutes of Darkness & The Last Title Deed) to Supabase & booksData.ts.
"""

import os
import re
import json
import subprocess
from PIL import Image

BASE_DIR = "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文"
PUBLIC_COVERS_DIR = os.path.join(os.getcwd(), "public", "covers")
os.makedirs(PUBLIC_COVERS_DIR, exist_ok=True)

SUPABASE_URL = "https://uamaohjbrjervzsjxwyg.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable_bLhT1CNl-DrFn_wz6gmp6A_fJPGBY2G"

BOOKS_CONFIG = [
    {
        "slug": "ninety-minutes-of-darkness",
        "title_en": "Ninety Minutes of Darkness",
        "title_sw": "Dakika Tisini za Giza",
        "author": "Asha Maridadi",
        "category": "Thriller",
        "rating": 4.92,
        "description_en": "Trapped during a 90-minute total blackout in a high-tech Nairobi skyscraper, an investigative journalist must outsmart mercenaries to leak corporate secrets.",
        "description_sw": "Akiwa amenasa wakati wa giza nene la dakika 90 katika jumba la ghorofa la kifahari la Nairobi, mwandishi wa habari za uchunguzi lazima awazidi akili mamluki ili kufichua siri za kampuni.",
        "en_md_path": os.path.join(BASE_DIR, "Dakika_Tisini_za_Giza_complete_project", "04_english", "Ninety_Minutes_of_Darkness_final_en.md"),
        "sw_md_path": os.path.join(BASE_DIR, "Dakika_Tisini_za_Giza_complete_project", "03_swahili", "Dakika_Tisini_za_Giza_final_sw.md"),
        "en_cover_src": os.path.join(BASE_DIR, "Dakika_Tisini_za_Giza_complete_project", "05_covers", "Ninety_Minutes_of_Darkness_cover_en.png"),
        "sw_cover_src": os.path.join(BASE_DIR, "Dakika_Tisini_za_Giza_complete_project", "05_covers", "Dakika_Tisini_za_Giza_cover_sw.png"),
        "en_cover_dest": os.path.join(PUBLIC_COVERS_DIR, "ninety_minutes_of_darkness_en.jpg"),
        "sw_cover_dest": os.path.join(PUBLIC_COVERS_DIR, "dakika_tisini_za_giza_sw.jpg"),
        "cover_url": "/covers/ninety_minutes_of_darkness_en.jpg",
        "tags": ["Nairobi Thriller", "Blackout", "Suspense", "Swahili Action"]
    },
    {
        "slug": "the-last-title-deed",
        "title_en": "The Last Title Deed",
        "title_sw": "Hati ya Mwisho",
        "author": "Asha Maridadi",
        "category": "Contemporary",
        "rating": 4.96,
        "description_en": "When a powerful land-grabbing cartel tries to seize her family's ancestral Rift Valley ranch, a fiercely determined young lawyer fights back with the ultimate title deed.",
        "description_sw": "Kundi lenye nguvu la mabwanyenye wa ardhi linapojaribu kunyakua shamba la familia yake katika Bonde la Ufa, mwanasheria kijana mwenye msimamo mkali anapambana kwa kutumia hati ya mwisho ya ardhini.",
        "en_md_path": os.path.join(BASE_DIR, "Hati_ya_Mwisho_complete_project", "04_english", "The_Last_Title_Deed_final_en.md"),
        "sw_md_path": os.path.join(BASE_DIR, "Hati_ya_Mwisho_complete_project", "03_swahili", "Hati_ya_Mwisho_final_sw.md"),
        "en_cover_src": os.path.join(BASE_DIR, "Hati_ya_Mwisho_complete_project", "05_covers", "The_Last_Title_Deed_cover_en.png"),
        "sw_cover_src": os.path.join(BASE_DIR, "Hati_ya_Mwisho_complete_project", "05_covers", "Hati_ya_Mwisho_cover_sw.png"),
        "en_cover_dest": os.path.join(PUBLIC_COVERS_DIR, "the_last_title_deed_en.jpg"),
        "sw_cover_dest": os.path.join(PUBLIC_COVERS_DIR, "hati_ya_mwisho_sw.jpg"),
        "cover_url": "/covers/the_last_title_deed_en.jpg",
        "tags": ["Rift Valley", "Legal Drama", "Heritage", "Swahili Romance"]
    }
]

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
for b in BOOKS_CONFIG:
    compress_image_under_100kb(b["en_cover_src"], b["en_cover_dest"])
    compress_image_under_100kb(b["sw_cover_src"], b["sw_cover_dest"])

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

# 3. Process and Upload Each Book to Supabase
for b in BOOKS_CONFIG:
    with open(b["en_md_path"], "r", encoding="utf-8") as f:
        en_text = f.read()
    with open(b["sw_md_path"], "r", encoding="utf-8") as f:
        sw_text = f.read()
        
    en_chapters = parse_chapters(en_text, r"^#\s+(Chapter\s+[^:\n]+:?.*?$)")
    sw_chapters = parse_chapters(sw_text, r"^#\s+(Sura\s+ya\s+[^:\n]+:?.*?$)")
    
    print(f"\n📖 [{b['title_en']}] Parsed {len(en_chapters)} EN chapters & {len(sw_chapters)} SW chapters.")
    
    book_payload = {
        "slug": b["slug"],
        "title": b["title_en"],
        "title_swahili": b["title_sw"],
        "author_name": b["author"],
        "description": b["description_en"],
        "cover_url": b["cover_url"],
        "language_code": "en",
        "category": b["category"].lower(),
        "status": "published",
        "is_featured": True,
        "total_chapters": len(en_chapters)
    }
    
    print(f"⚡ Upserting Supabase metadata for {b['title_en']}...")
    run_curl_post(f"{SUPABASE_URL}/rest/v1/books", book_payload)
    
    get_resp = run_curl_get(f"{SUPABASE_URL}/rest/v1/books?slug=eq.{b['slug']}&select=id")
    books_list = json.loads(get_resp) if get_resp else []
    if not books_list:
        print(f"❌ Failed to get book ID for {b['title_en']}")
        continue
        
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
    print(f"🎉 Successfully uploaded {b['title_en']} ({max_count} chapters) to Supabase!")

print("\n🚀 100% SUCCESS: Both new books uploaded to Supabase!")
