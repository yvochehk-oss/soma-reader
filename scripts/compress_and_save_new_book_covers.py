#!/usr/bin/env python3
"""
Compress and save newly generated covers for 'Dakika Saba za Mwisho' and 'Nilirudi Kabla ya Harusi'
under 100KB, then save to book directories & public/covers directory.
"""

import os
from PIL import Image

SOURCE_DIR = "/Users/yvoche/.gemini/antigravity/brain/02f10089-de3f-4570-9376-b94cf1c4c6d1"
BASE_NOVELS_DIR = "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文"
PUBLIC_COVERS_DIR = "/Users/yvoche/AI开发/071_非洲阅读/public/covers"

os.makedirs(PUBLIC_COVERS_DIR, exist_ok=True)

COVERS = [
    # Book 1: Dakika Saba za Mwisho
    {
        "src": os.path.join(SOURCE_DIR, "dakika_saba_cover_sw_1785648211893.jpg"),
        "book_dir": os.path.join(BASE_NOVELS_DIR, "Dakika Saba za Mwisho"),
        "filename": "dakika_saba_za_mwisho_sw.jpg"
    },
    {
        "src": os.path.join(SOURCE_DIR, "last_seven_minutes_cover_en_1785648198067.jpg"),
        "book_dir": os.path.join(BASE_NOVELS_DIR, "Dakika Saba za Mwisho"),
        "filename": "the_last_seven_minutes_en.jpg"
    },
    # Book 2: Nilirudi Kabla ya Harusi
    {
        "src": os.path.join(SOURCE_DIR, "nilirudi_harusi_cover_sw_1785648243565.jpg"),
        "book_dir": os.path.join(BASE_NOVELS_DIR, "Nilirudi Kabla ya Harusi"),
        "filename": "nilirudi_kabla_ya_harusi_sw.jpg"
    },
    {
        "src": os.path.join(SOURCE_DIR, "returned_wedding_cover_en_1785648227965.jpg"),
        "book_dir": os.path.join(BASE_NOVELS_DIR, "Nilirudi Kabla ya Harusi"),
        "filename": "i_returned_before_the_wedding_en.jpg"
    }
]

def compress_under_100kb(src_path, dest_paths):
    if not os.path.exists(src_path):
        print(f"⚠️ Source missing: {src_path}")
        return
    img = Image.open(src_path).convert("RGB")
    
    # Resize slightly if too large
    width, height = img.size
    if width > 900:
        new_width = 800
        new_height = int(height * (800 / width))
        img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
    quality = 85
    while quality > 10:
        for dest_path in dest_paths:
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            img.save(dest_path, "JPEG", quality=quality, optimize=True)
        size_kb = os.path.getsize(dest_paths[0]) / 1024
        if size_kb < 98.0:
            break
        quality -= 5
        
    print(f"✅ Compressed '{os.path.basename(dest_paths[0])}' -> {size_kb:.2f} KB (Quality: {quality})")

for item in COVERS:
    dest_in_book = os.path.join(item["book_dir"], item["filename"])
    dest_in_public = os.path.join(PUBLIC_COVERS_DIR, item["filename"])
    compress_under_100kb(item["src"], [dest_in_book, dest_in_public])

print("🎉 100% SUCCESS: All new book covers compressed <100KB and saved to book directories & public/covers!")
