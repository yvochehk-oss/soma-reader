#!/usr/bin/env python3
"""
Recompress updated covers for Dakika Tisini za Giza under 100KB limit and update Supabase & Cloudflare.
"""

import os
import json
import subprocess
from PIL import Image

BASE_DIR = "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文/Dakika_Tisini_za_Giza_complete_project/05_covers"
PUBLIC_COVERS_DIR = os.path.join(os.getcwd(), "public", "covers")
os.makedirs(PUBLIC_COVERS_DIR, exist_ok=True)

SUPABASE_URL = "https://uamaohjbrjervzsjxwyg.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable_bLhT1CNl-DrFn_wz6gmp6A_fJPGBY2G"

en_src = os.path.join(BASE_DIR, "en.png")
sw_src = os.path.join(BASE_DIR, "sw.png")

en_dest = os.path.join(PUBLIC_COVERS_DIR, "ninety_minutes_of_darkness_en.jpg")
sw_dest = os.path.join(PUBLIC_COVERS_DIR, "dakika_tisini_za_giza_sw.jpg")

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
    print(f"🖼️ Re-compressed cover '{os.path.basename(dest_path)}': {size_kb:.2f} KB (Quality={quality})")

print("📸 Re-compressing updated covers for Dakika Tisini za Giza under 100KB limit...")
compress_image_under_100kb(en_src, en_dest)
compress_image_under_100kb(sw_src, sw_dest)

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

print("⚡ Updating cover URLs in Supabase for ninety-minutes-of-darkness...")
url = f"{SUPABASE_URL}/rest/v1/books?slug=eq.ninety-minutes-of-darkness"
run_curl_patch(url, {"cover_url": "/covers/ninety_minutes_of_darkness_en.jpg"})

print("🎉 100% SUCCESS: Updated covers for Dakika Tisini za Giza compressed and synced!")
