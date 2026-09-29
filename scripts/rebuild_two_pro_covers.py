import os
import sys
import time
import subprocess
import glob
from PIL import Image, ImageDraw, ImageFont, ImageFilter

BOOKS_TO_REBUILD = [
    {
        "id": "risiti_ya_marehemu",
        "dir": "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文/02_已发布/2026-09-12_risiti_ya_marehemu",
        "title_sw": "RISITI YA MAREHEMU",
        "title_en": "RECEIPT OF THE DECEASED",
        "author": "Safiya Amani",
        "layout": "top",
        "font_family": "baskerville",
        "title_color": (255, 215, 0),       # Rich Gold
        "stroke_color": (15, 23, 42),       # Dark Navy
        "prompt": (
            "Full-bleed 2D cinematic drama photography filling the entire 3:4 vertical frame edge-to-edge. "
            "NO 3D book mockup, NO physical book object, NO table mockup, NO text, NO watermarks. "
            "Scene: An elegant 46yo African widow in a traditional dark floral headwrap and dress standing in a moody coastal Swahili living room at dusk, "
            "staring in disbelief at an official yellowed paper receipt document in her hand. "
            "Across the room, a mysterious young African man stands quietly in the doorway shadows, and her grown eldest son looks away with guilt. "
            "Warm amber lamp glow, deep shadow contrast, soft evening coastal breeze, dramatic family secret confrontation, "
            "shot on 35mm anamorphic lens, hyper-realistic, 8k resolution, award-winning cinematic still"
        )
    },
    {
        "id": "deni_lisilokuwa_langu",
        "dir": "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文/02_已发布/2026-09-19_deni_lisilokuwa_langu",
        "title_sw": "DENI LISILOKUWA LANGU",
        "title_en": "THE DEBT THAT WASN'T MINE",
        "author": "Soma Originals",
        "layout": "top",
        "font_family": "impact",
        "title_color": (254, 240, 138),      # High-visibility electric amber
        "stroke_color": (10, 10, 15),       # Deep Obsidian
        "prompt": (
            "Full-bleed 2D cinematic thriller photography filling the entire 3:4 vertical frame edge-to-edge. "
            "NO 3D book mockup, NO physical book object, NO table mockup, NO text, NO watermarks. "
            "Scene: A handsome 28yo hardworking African auto mechanic in blue denim coveralls with grease-stained hands standing in an open-air Mombasa repair garage, "
            "holding a red-stamped bank foreclosure notice with a stunned, defiant expression. "
            "In the background, two imposing bank debt recovery agents in tailored dark suits hold black briefcases near a classic vintage car engine. "
            "Dramatic golden hour sun rays slicing through industrial roof slats, gritty realistic textures, atmospheric dust particles, "
            "shot on 35mm lens, hyper-realistic, 8k resolution, intense cinematic movie still"
        )
    }
]

FONT_MAP = {
    "georgia": "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
    "baskerville": "/System/Library/Fonts/Supplemental/Baskerville.ttc",
    "didot": "/System/Library/Fonts/Supplemental/Didot.ttc",
    "impact": "/System/Library/Fonts/Supplemental/Impact.ttf",
    "trebuchet": "/System/Library/Fonts/Supplemental/Trebuchet MS Bold.ttf",
    "arial_black": "/System/Library/Fonts/Supplemental/Arial Black.ttf",
    "copperplate": "/System/Library/Fonts/Supplemental/Copperplate.ttc",
    "arial": "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
}

def get_font(family, size):
    font_path = FONT_MAP.get(family, FONT_MAP["georgia"])
    try:
        return ImageFont.truetype(font_path, size)
    except Exception:
        return ImageFont.truetype(FONT_MAP["georgia"], size)

def render_typography(base_img_path, title_text, author_text, layout, font_family, title_color, stroke_color, out_path):
    base_raw = Image.open(base_img_path).convert("RGBA")
    W, H = 1024, 1365
    base = base_raw.resize((W, H), Image.Resampling.LANCZOS)
    
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    
    # 1. Top Logo Badge
    logo_font = get_font("georgia", 36)
    draw.text((48, 48), "SOMANOVEL", font=logo_font, fill=(255, 255, 255, 230), stroke_width=2, stroke_fill=(0, 0, 0, 255))
    
    # 2. Bottom Watermark
    wm_font = get_font("arial", 24)
    wm_text = "SOMANOVEL • FREE MOBILE READS • WWW.SOMANOVEL.UK"
    wm_bbox = draw.textbbox((0, 0), wm_text, font=wm_font)
    wm_w = wm_bbox[2] - wm_bbox[0]
    draw.text(((W - wm_w) // 2, H - 56), wm_text, font=wm_font, fill=(255, 255, 255, 220), stroke_width=2, stroke_fill=(0, 0, 0, 255))
    
    # 3. Title Wrapping
    words = title_text.upper().split()
    lines = []
    curr = []
    for w in words:
        curr.append(w)
        test_line = " ".join(curr)
        t_font = get_font(font_family, 76 if len(title_text) > 15 else 88)
        t_bbox = draw.textbbox((0, 0), test_line, font=t_font)
        if (t_bbox[2] - t_bbox[0]) > (W - 120):
            if len(curr) > 1:
                curr.pop()
                lines.append(" ".join(curr))
                curr = [w]
            else:
                lines.append(test_line)
                curr = []
    if curr:
        lines.append(" ".join(curr))
        
    font_size = 72 if len(lines) > 2 else (82 if len(lines) == 2 else 92)
    t_font = get_font(font_family, font_size)
    author_font = get_font("georgia", 42)
    
    line_height = int(font_size * 1.18)
    total_title_h = len(lines) * line_height
    
    if layout == "top":
        start_y = 140
    else:  # bottom
        start_y = H - 100 - (total_title_h + 80)
        
    # Draw soft back-glow / subtle gradient patch for readability
    scrim = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    scrim_draw = ImageDraw.Draw(scrim)
    scrim_rect_top = start_y - 25
    scrim_rect_bot = start_y + total_title_h + 75
    scrim_draw.rectangle([0, scrim_rect_top, W, scrim_rect_bot], fill=(0, 0, 0, 110))
    scrim = scrim.filter(ImageFilter.GaussianBlur(25))
    base = Image.alpha_composite(base, scrim)
    
    cur_y = start_y
    for line in lines:
        l_bbox = draw.textbbox((0, 0), line, font=t_font)
        l_w = l_bbox[2] - l_bbox[0]
        x = (W - l_w) // 2
        draw.text((x, cur_y), line, font=t_font, fill=title_color + (255,), stroke_width=6, stroke_fill=stroke_color + (255,))
        cur_y += line_height
        
    author_str = f"BY  {author_text.upper()}"
    a_bbox = draw.textbbox((0, 0), author_str, font=author_font)
    a_w = a_bbox[2] - a_bbox[0]
    draw.text(((W - a_w) // 2, cur_y + 12), author_str, font=author_font, fill=(255, 255, 255, 245), stroke_width=3, stroke_fill=(0, 0, 0, 255))
    
    final_img = Image.alpha_composite(base, overlay)
    out_img = final_img.convert("RGB").resize((768, 1024), Image.Resampling.LANCZOS)
    out_img.save(out_path, "JPEG", quality=95)
    print(f"Saved cover: {out_path}")

def process_book(book):
    book_dir = book["dir"]
    base_art_path = os.path.join(book_dir, "raw_ai_art.png")
    
    print(f"\n=======================================================")
    print(f"Rebuilding Pro Cover for: {book['title_sw']} / {book['title_en']}")
    print(f"Target Dir: {book_dir}")
    print(f"Prompt: {book['prompt']}")
    
    codex_instruction = (
        f"Generate a full-bleed 2D vertical 3:4 portrait orientation photorealistic image using the built-in image_gen tool: "
        f"{book['prompt']}. "
        f"Save or copy the resulting image file directly to {base_art_path}"
    )
    
    cmd = [
        "/opt/homebrew/bin/codex", "exec",
        "--dangerously-bypass-approvals-and-sandbox",
        codex_instruction
    ]
    
    print(f"Invoking Codex CLI image_gen cloud model...")
    t0 = time.time()
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Codex CLI stderr: {res.stderr}")
    print(f"Codex CLI stdout: {res.stdout}")
    print(f"Image generation completed in {time.time() - t0:.1f}s")
    
    if not os.path.exists(base_art_path) or os.path.getsize(base_art_path) < 10000:
        print(f"Checking ~/.codex/generated_images for newest png...")
        codex_imgs = sorted(glob.glob(os.path.expanduser("~/.codex/generated_images/*/*.png")), key=os.path.getmtime, reverse=True)
        if codex_imgs and (time.time() - os.path.getmtime(codex_imgs[0]) < 180):
            print(f"Recovered from newest codex generated image: {codex_imgs[0]}")
            Image.open(codex_imgs[0]).save(base_art_path)
        else:
            print(f"Error: Could not obtain generated image for {book['id']}")
            return False
            
    # Render SW cover
    cover_sw_path = os.path.join(book_dir, "cover_sw.jpg")
    cover_path = os.path.join(book_dir, "cover.jpg")
    render_typography(
        base_art_path,
        book["title_sw"],
        book["author"],
        book["layout"],
        book["font_family"],
        book["title_color"],
        book["stroke_color"],
        cover_sw_path
    )
    Image.open(cover_sw_path).save(cover_path, "JPEG", quality=95)
    
    # Render EN cover
    cover_en_path = os.path.join(book_dir, "cover_en.jpg")
    render_typography(
        base_art_path,
        book["title_en"],
        book["author"],
        book["layout"],
        book["font_family"],
        book["title_color"],
        book["stroke_color"],
        cover_en_path
    )
    
    # Upload immediately via upload-soma-books.mjs
    print(f"Uploading book {book['id']} to Supabase...")
    upload_cmd = [
        "node", "/Users/yvoche/AI开发/071_非洲阅读/scripts/upload-soma-books.mjs",
        book_dir,
        "--publish"
    ]
    up_res = subprocess.run(upload_cmd, capture_output=True, text=True)
    print(up_res.stdout)
    if up_res.returncode != 0:
        print(f"Upload error: {up_res.stderr}")
        return False
        
    print(f"Book {book['id']} complete and published!")
    return True

if __name__ == "__main__":
    for b in BOOKS_TO_REBUILD:
        success = process_book(b)
        if not success:
            print(f"Failed at {b['id']}")
            sys.exit(1)
