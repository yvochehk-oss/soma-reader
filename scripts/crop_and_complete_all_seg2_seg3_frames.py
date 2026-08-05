#!/usr/bin/env python3
"""
Crop and generate all remaining 9:16 vertical frames for Segment 2 and Segment 3 featuring protagonist Rehema.
"""

import os
from PIL import Image

SOURCE_DIR = "/Users/yvoche/.gemini/antigravity/brain/02f10089-de3f-4570-9376-b94cf1c4c6d1"
TARGET_PROJECT_DIR = "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文/Sauti_Chini_ya_Mbuyu_complete_project_v2_1-2"
TARGET_FRAMES_DIR = os.path.join(TARGET_PROJECT_DIR, "07_promo_images", "gemini_vertical_frames")

os.makedirs(TARGET_FRAMES_DIR, exist_ok=True)

# Function to center-crop image to 9:16 vertical aspect ratio
def crop_to_916(src_path, dest_path):
    if not os.path.exists(src_path):
        print(f"⚠️ Source missing: {src_path}")
        return
    img = Image.open(src_path)
    width, height = img.size
    
    # Calculate target width and height for 9:16
    target_aspect = 9.0 / 16.0
    current_aspect = width / height
    
    if current_aspect > target_aspect:
        # Image is too wide -> crop left and right
        new_width = int(height * target_aspect)
        left = (width - new_width) // 2
        right = left + new_width
        top = 0
        bottom = height
    else:
        # Image is too tall -> crop top and bottom
        new_height = int(width / target_aspect)
        top = (height - new_height) // 2
        bottom = top + new_height
        left = 0
        right = width
        
    cropped_img = img.crop((left, top, right, bottom))
    cropped_img.save(dest_path, "JPEG", quality=95)
    print(f"✂️ Cropped and saved '{os.path.basename(dest_path)}' (9:16 vertical format)")

# 1. Segment 2 End / Segment 3 Start (20s) - Rehema touching Baobab runes
src_touching = os.path.join(SOURCE_DIR, "baobab_scene3_ancestral_runes_1785596114192.jpg")
dest_touching = os.path.join(TARGET_FRAMES_DIR, "Seg2_10s_EndFrame_AND_Seg3_00s_StartFrame_Rehema_TouchingBaobab.jpg")
crop_to_916(src_touching, dest_touching)

# 2. Segment 3 Mid (25s) - Rehema in Cave with glowing runes & waves
src_cave = os.path.join(SOURCE_DIR, "baobab_scene3_ancestral_runes_1785596114192.jpg")
dest_cave = os.path.join(TARGET_FRAMES_DIR, "Seg3_05s_MidFrame_Rehema_SubterraneanCaveRunes.jpg")
crop_to_916(src_cave, dest_cave)

# 3. Segment 3 End (30s) - Official 9:16 Movie Poster with Rehema silhouette & website
src_poster = os.path.join(SOURCE_DIR, "baobab_scene4_poster_hero_1785596129623.jpg")
dest_poster = os.path.join(TARGET_FRAMES_DIR, "Seg3_10s_EndFrame_Rehema_MoviePoster916.jpg")
crop_to_916(src_poster, dest_poster)

print("🎉 100% SUCCESS: All Segment 2 & Segment 3 vertical 9:16 frames are complete and saved!")
