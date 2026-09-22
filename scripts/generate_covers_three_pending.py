#!/usr/bin/env python3
"""
Regenerate clean covers for the 3 books in /正文/ that still need a 2x crisp
title/author overlay, using uvx-managed mflux (no system pip).

Books covered:
  - 2026-08-08_nyumba_isiyouzwa
  - 2026-08-12_namba_iliyokufa_mara_mbili
  - 2026-08-13_dawa_ya_usiku
"""
import os
import shutil
import subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont

BASE_DIR = "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文/正文"
MFLUX_BIN = "uvx"
MFLUX_PREFIX = ["--from", "mflux", "mflux-generate-flux2"]
MODEL_NAME = "/Users/yvoche/omlx-models/flux2-klein-4b"
ART_DIR_FALLBACK = "/tmp/cover_artifacts"

BOOKS = [
    {
        'folder': '2026-08-08_nyumba_isiyouzwa',
        'title_sw': 'Nyumba Isiyouzwa',
        'title_en': 'The House That Would Not Sell',
        'author': 'Layla Pendo',
        'prompt': 'A weathered two-story East African colonial house at dusk, a bright orange FOR SALE sign wired to its wooden door, warm amber streetlight, laundry hanging on a balcony, kanga fabric blowing in the salty sea breeze, cinematic suspense atmosphere, bestseller book cover art, 8k',
        'seed': '808808',
    },
    {
        'folder': '2026-08-12_namba_iliyokufa_mara_mbili',
        'title_sw': 'Namba Iliyokufa Mara Mbili',
        'title_en': 'The Number That Died Twice',
        'author': 'Farida Jua',
        'prompt': 'A dimly lit reconciliation office before dawn, a single accountant staring at a glowing blue spreadsheet on a laptop, a thick paper ledger open beside a cooling cup of chai, stacks of bank reconciliation sheets, moody teal and amber lighting, suspense thriller atmosphere, bestseller book cover art, 8k',
        'seed': '202608',
    },
    {
        'folder': '2026-08-13_dawa_ya_usiku',
        'title_sw': 'Dawa ya Usiku',
        'title_en': 'The Night Medicine',
        'author': 'Malaika Mtoni',
        'prompt': 'A small night-pharmacy interior glowing in cool fluorescent green, a collapsed young man slumped against the counter, a glass vial rolling on the wet floor, rain streaking the front window, an old prescription register half open, cinematic medical thriller mood, bestseller book cover art, 8k',
        'seed': '131313',
    },
]


def analyze_layout_and_palette(img_2x):
    np_img = np.array(img_2x.convert('L'))
    h, w = np_img.shape

    upper_zone = np_img[int(h*0.10):int(h*0.40), :]
    lower_zone = np_img[int(h*0.55):int(h*0.85), :]

    upper_lum = np.mean(upper_zone)
    lower_lum = np.mean(lower_zone)

    upper_act = np.std(upper_zone) + upper_lum * 0.5
    lower_act = np.std(lower_zone) + lower_lum * 0.5

    position = 'bottom' if upper_act >= lower_act else 'top'
    target_lum = lower_lum if position == 'bottom' else upper_lum

    if target_lum < 110:
        font_fill = (255, 255, 255, 255)
        stroke_color = (15, 20, 30, 255)
        inner_highlight = (245, 240, 230, 255)
        author_color = (245, 230, 185, 255)
    else:
        font_fill = (255, 215, 80, 255)
        stroke_color = (80, 50, 10, 255)
        inner_highlight = (255, 245, 200, 255)
        author_color = (255, 235, 170, 255)

    return position, font_fill, stroke_color, inner_highlight, author_color


def render_smart_title_snell(draw, title_str, start_y, W_2x, max_width,
                             font_fill, stroke_color, inner_highlight):
    words = title_str.split()

    for font_sz in range(110, 45, -5):
        font = ImageFont.truetype(
            '/System/Library/Fonts/Supplemental/SnellRoundhand.ttc', font_sz)

        if len(words) <= 2:
            lines = [' '.join(words)]
        elif len(words) == 3:
            lines = [' '.join(words[:2]), words[2]]
        else:
            mid = len(words) // 2
            lines = [' '.join(words[:mid]), ' '.join(words[mid:])]

        all_fit = True
        for line in lines:
            bbox = font.getbbox(line)
            w = bbox[2] - bbox[0]
            if w > max_width:
                all_fit = False
                break

        if all_fit:
            line_height = font_sz * 1.15
            last_line_bottom = start_y
            for i, line in enumerate(lines):
                bbox = font.getbbox(line)
                w = bbox[2] - bbox[0]
                line_x = (W_2x - w) // 2
                line_y = start_y + i * line_height
                last_line_bottom = line_y + (bbox[3] - bbox[1])

                draw.text((line_x + 3, line_y + 3), line, font=font,
                          fill=(0, 0, 0, 240), stroke_width=4,
                          stroke_fill=(0, 0, 0, 255))
                draw.text((line_x, line_y), line, font=font,
                          fill=font_fill, stroke_width=3,
                          stroke_fill=stroke_color)
                draw.text((line_x - 1, line_y - 1), line, font=font,
                          fill=inner_highlight)
            return last_line_bottom

    return start_y + 100


def composite_cover_2x(raw_img_path, title, author, output_path):
    cover = Image.open(raw_img_path).convert('RGBA')
    bbox = cover.getbbox()
    cover_cropped = cover.crop(bbox)

    W_2x, H_2x = 1024, 1536
    cover_full = cover_cropped.resize(
        (W_2x, H_2x), Image.Resampling.LANCZOS).convert('RGBA')

    overlay = Image.new('RGBA', (W_2x, H_2x), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    font_author = ImageFont.truetype(
        '/System/Library/Fonts/Supplemental/Georgia Bold.ttf', 36)
    font_bottom_crisp = ImageFont.truetype(
        '/System/Library/Fonts/Supplemental/Arial Bold.ttf', 30)

    position, font_fill, stroke_color, inner_highlight, author_color = \
        analyze_layout_and_palette(cover_full)
    MAX_W = W_2x - 80

    start_y = 1040 if position == 'bottom' else 140

    last_title_bottom = render_smart_title_snell(
        draw, title, start_y, W_2x, MAX_W, font_fill, stroke_color,
        inner_highlight)

    author_str = author.upper()
    bbox_a = font_author.getbbox(author_str)
    author_w = bbox_a[2] - bbox_a[0]
    author_x = (W_2x - author_w) // 2
    author_y = last_title_bottom + 44

    draw.text((author_x, author_y), author_str, font=font_author,
              fill=author_color, stroke_width=4, stroke_fill=(10, 10, 15, 255))

    bottom_text = 'SOMANOVEL  •  FREE MOBILE READS  •  WWW.SOMANOVEL.UK'
    bbox_b = font_bottom_crisp.getbbox(bottom_text)
    bottom_w = bbox_b[2] - bbox_b[0]
    bottom_x = (W_2x - bottom_w) // 2
    bottom_y = H_2x - 46

    draw.text((bottom_x, bottom_y), bottom_text, font=font_bottom_crisp,
              fill=(255, 255, 255, 255), stroke_width=2,
              stroke_fill=(0, 0, 0, 255))

    final_img_2x = Image.alpha_composite(cover_full, overlay).convert('RGB')
    final_img = final_img_2x.resize((512, 768), Image.Resampling.LANCZOS)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    final_img.save(output_path, quality=99)


def generate_base_for_book(book, idx):
    """Run mflux via uvx to create the raw base image."""
    raw_png = f"/tmp/clean_base_{idx}.png"
    if os.path.exists(raw_png):
        return raw_png

    cmd = [
        MFLUX_BIN, *MFLUX_PREFIX,
        '--model', MODEL_NAME,
        '--prompt', book['prompt'],
        '--width', '512',
        '--height', '768',
        '--steps', '4',
        '--seed', book['seed'],
        '--output', raw_png,
    ]
    print(f"[mflux] {' '.join(cmd)}")
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        print(f"  ! mflux failed: {proc.stderr[-500:] if proc.stderr else proc.stdout[-500:]}")
        return None
    return raw_png if os.path.exists(raw_png) else None


def generate_three_covers():
    print("=" * 50)
    print(" 🚀 重生成 3 本书的【纯书名+作者+底部推广】双语封面")
    print("=" * 50)

    os.makedirs(ART_DIR_FALLBACK, exist_ok=True)

    for idx, b in enumerate(BOOKS, 1):
        target_dir = os.path.join(BASE_DIR, b['folder'])
        os.makedirs(target_dir, exist_ok=True)

        raw = generate_base_for_book(b, idx)
        if not raw:
            print(f"   ❌ skip {b['folder']}: base image not produced")
            continue

        cover_sw_path = os.path.join(target_dir, 'cover_sw.jpg')
        composite_cover_2x(raw, b['title_sw'], b['author'], cover_sw_path)

        cover_en_path = os.path.join(target_dir, 'cover_en.jpg')
        composite_cover_2x(raw, b['title_en'], b['author'], cover_en_path)

        # Mobile cover (keep existing filename convention)
        mobile_name = b['folder'].replace('2026-08-08_', '').replace('2026-08-12_', '').replace('2026-08-13_', '')
        mob_path = os.path.join(target_dir, f'mobile_{mobile_name}_cover.jpg')
        shutil.copy(cover_sw_path, mob_path)

        # Artifacts (fallback since antigravity brain path died)
        art_sw = os.path.join(ART_DIR_FALLBACK, f"clean_cover_sw_{b['folder']}.jpg")
        art_en = os.path.join(ART_DIR_FALLBACK, f"clean_cover_en_{b['folder']}.jpg")
        shutil.copy(cover_sw_path, art_sw)
        shutil.copy(cover_en_path, art_en)

        print(f"   ✅ {b['folder']}: sw + en + mobile + artifact done")


if __name__ == "__main__":
    generate_three_covers()
