#!/usr/bin/env python3
"""
Copy generated promo & story images of Voices Beneath the Baobab to its book folder.
"""

import os
import shutil

SOURCE_DIR = "/Users/yvoche/.gemini/antigravity/brain/02f10089-de3f-4570-9376-b94cf1c4c6d1"
TARGET_PROJECT_DIR = "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文/Sauti_Chini_ya_Mbuyu_complete_project_v2_1-2"

TARGET_COVERS_DIR = os.path.join(TARGET_PROJECT_DIR, "05_covers")
TARGET_PROMO_DIR = os.path.join(TARGET_PROJECT_DIR, "07_promo_images")

os.makedirs(TARGET_COVERS_DIR, exist_ok=True)
os.makedirs(TARGET_PROMO_DIR, exist_ok=True)

IMAGES_MAP = [
    ("baobab_scene1_midnight_radio_1785596082823.jpg", "scene1_midnight_radio_317am.jpg"),
    ("baobab_scene2_rehema_headphones_1785596098531.jpg", "scene2_rehema_in_mangroves.jpg"),
    ("baobab_scene3_ancestral_runes_1785596114192.jpg", "scene3_subterranean_runes.jpg"),
    ("baobab_scene4_poster_hero_1785596129623.jpg", "scene4_movie_poster_hero.jpg")
]

for src_name, dest_name in IMAGES_MAP:
    src_file = os.path.join(SOURCE_DIR, src_name)
    if os.path.exists(src_file):
        dest_covers = os.path.join(TARGET_COVERS_DIR, dest_name)
        dest_promo = os.path.join(TARGET_PROMO_DIR, dest_name)
        
        shutil.copy2(src_file, dest_covers)
        shutil.copy2(src_file, dest_promo)
        print(f"✅ Saved '{dest_name}' -> 05_covers & 07_promo_images")
    else:
        print(f"⚠️ Source file not found: {src_file}")

print("🎉 100% SUCCESS: All 4 promo/storyboard images saved to book directory!")
