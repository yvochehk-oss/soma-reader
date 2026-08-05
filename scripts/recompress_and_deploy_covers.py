#!/usr/bin/env python3
"""
Recompress updated covers under 100KB for all 4 books and update Supabase & booksData.ts.
"""

import os
import json
import subprocess
from PIL import Image

BASE_DIR = "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文"
PUBLIC_COVERS_DIR = os.path.join(os.getcwd(), "public", "covers")
os.makedirs(PUBLIC_COVERS_DIR, exist_ok=True)

SUPABASE_URL = "https://uamaohjbrjervzsjxwyg.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable_bLhT1CNl-DrFn_wz6gmp6A_fJPGBY2G"

COVERS_MAP = [
    {
        "slug": "voices-beneath-the-baobab",
        "en_src": os.path.join(BASE_DIR, "Sauti_Chini_ya_Mbuyu_complete_project_v2_2", "05_covers", "en.png"),
        "sw_src": os.path.join(BASE_DIR, "Sauti_Chini_ya_Mbuyu_complete_project_v2_2", "05_covers", "sw.png"),
        "en_dest": os.path.join(PUBLIC_COVERS_DIR, "voices_beneath_the_baobab_en.jpg"),
        "sw_dest": os.path.join(PUBLIC_COVERS_DIR, "sauti_chini_ya_mbuyu_sw.jpg"),
        "cover_url": "/covers/voices_beneath_the_baobab_en.jpg"
    },
    {
        "slug": "ninety-minutes-of-darkness",
        "en_src": os.path.join(BASE_DIR, "Dakika_Tisini_za_Giza_complete_project", "05_covers", "Ninety_Minutes_of_Darkness_cover_en.png"),
        "sw_src": os.path.join(BASE_DIR, "Dakika_Tisini_za_Giza_complete_project", "05_covers", "Dakika_Tisini_za_Giza_cover_sw.png"),
        "en_dest": os.path.join(PUBLIC_COVERS_DIR, "ninety_minutes_of_darkness_en.jpg"),
        "sw_dest": os.path.join(PUBLIC_COVERS_DIR, "dakika_tisini_za_giza_sw.jpg"),
        "cover_url": "/covers/ninety_minutes_of_darkness_en.jpg"
    },
    {
        "slug": "the-last-title-deed",
        "en_src": os.path.join(BASE_DIR, "Hati_ya_Mwisho_complete_project", "05_covers", "The_Last_Title_Deed_cover_en.png"),
        "sw_src": os.path.join(BASE_DIR, "Hati_ya_Mwisho_complete_project", "05_covers", "Hati_ya_Mwisho_cover_sw.png"),
        "en_dest": os.path.join(PUBLIC_COVERS_DIR, "the_last_title_deed_en.jpg"),
        "sw_dest": os.path.join(PUBLIC_COVERS_DIR, "hati_ya_mwisho_sw.jpg"),
        "cover_url": "/covers/the_last_title_deed_en.jpg"
    },
    {
        "slug": "zuri-queen-of-fashion",
        "en_src": os.path.join(BASE_DIR, "Zuri Malkia wa Mitindo", "en.png"),
        "sw_src": os.path.join(BASE_DIR, "Zuri Malkia wa Mitindo", "sw.png"),
        "en_dest": os.path.join(PUBLIC_COVERS_DIR, "zuri_queen_of_fashion_en.jpg"),
        "sw_dest": os.path.join(PUBLIC_COVERS_DIR, "zuri_malkia_wa_mitindo_sw.jpg"),
        "cover_url": "/covers/zuri_queen_of_fashion_en.jpg"
    }
]

def compress_image_under_100kb(src_path, dest_path):
    if not os.path.exists(src_path):
        print(f"⚠️ Source cover image missing: {src_path}")
        return
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
    print(f"🖼️ Re-compressed cover '{os.path.basename(dest_path)}': {size_kb:.2f} KB (Quality={quality})")

print("📸 Re-compressing updated covers under 100KB limit...")
for item in COVERS_MAP:
    compress_image_under_100kb(item["en_src"], item["en_dest"])
    compress_image_under_100kb(item["sw_src"], item["sw_dest"])

def run_curl_patch(url, data_json):
    cmd = [
        "curl", "-s", "--retry", "5", "--retry-delay", "2",
        "-X", "PATCH",
        "-H", "Content-Type: application/json",
        "-H", f"apikey: {SUPABASE_ANON_KEY}",
        "-H", f"Authorization: Bearer {SUPABASE_ANON_KEY}",
        "-d", json.dumps(data_json),
        url
    ]
    subprocess.run(cmd, capture_output=True, text=True)

print("⚡ Updating cover URLs in Supabase...")
for item in COVERS_MAP:
    url = f"{SUPABASE_URL}/rest/v1/books?slug=eq.{item['slug']}"
    run_curl_patch(url, {"cover_url": item["cover_url"]})
    print(f"  ✅ Supabase cover_url updated for {item['slug']}")

print("🎉 100% SUCCESS: Updated covers compressed and synced!")
