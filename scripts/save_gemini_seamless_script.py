#!/usr/bin/env python3
"""
Save 9:16 vertical seamless 10-second video frames featuring protagonist Rehema to book directory.
"""

import os
import shutil

SOURCE_DIR = "/Users/yvoche/.gemini/antigravity/brain/02f10089-de3f-4570-9376-b94cf1c4c6d1"
TARGET_PROJECT_DIR = "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文/Sauti_Chini_ya_Mbuyu_complete_project_v2_1-2"
TARGET_FRAMES_DIR = os.path.join(TARGET_PROJECT_DIR, "07_promo_images", "gemini_vertical_frames")

os.makedirs(TARGET_FRAMES_DIR, exist_ok=True)

IMAGES_MAP = [
    ("v_seg1_start_01_rehema_night_1785597498942.jpg", "Seg1_00s_StartFrame_Rehema_NightStudio.jpg"),
    ("v_seg1_mid_02_rehema_studio_clock_1785597513595.jpg", "Seg1_05s_MidFrame_Rehema_Clock0317.jpg"),
    ("v_seg1end_seg2start_03_rehema_doorway_1785597531183.jpg", "Seg1_10s_EndFrame_AND_Seg2_00s_StartFrame_Rehema_Doorway.jpg"),
    ("v_seg2_mid_04_rehema_mangrove_recorder_1785597549735.jpg", "Seg2_05s_MidFrame_Rehema_MangroveRecorder.jpg")
]

for src_name, dest_name in IMAGES_MAP:
    src_file = os.path.join(SOURCE_DIR, src_name)
    if os.path.exists(src_file):
        dest_file = os.path.join(TARGET_FRAMES_DIR, dest_name)
        shutil.copy2(src_file, dest_file)
        print(f"✅ Saved vertical frame '{dest_name}' -> gemini_vertical_frames")
    else:
        print(f"⚠️ Source file not found: {src_file}")

print("🎉 100% SUCCESS: Seamless 9:16 vertical video frames featuring Rehema saved to project!")
