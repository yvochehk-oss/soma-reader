import os
import sys
import json
import time
import subprocess
import glob
from PIL import Image, ImageDraw, ImageFont, ImageFilter

BOOKS = [
    {
        "id": 1,
        "dir": "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文/02_已发布/2026-09-06_utajiri_wa_siri",
        "title_sw": "UTAJIRI WA SIRI",
        "title_en": "SECRET WEALTH",
        "author": "Idris Mwangaza",
        "layout": "top",
        "font_family": "georgia",
        "title_color": (255, 215, 0),       # Gold
        "stroke_color": (15, 23, 42),       # Dark Slate
        "prompt": "Vertical 3:4 portrait book cover photo. An affluent 35yo handsome African man in a tailored dark blue suit standing tense in a modest brick living room in Nairobi, discreetly hiding a luxury gold watch behind his back, while an elderly uncle in traditional African kitenge and a curious younger cousin stare suspiciously across the wooden table, warm amber indoor lamp glow, rich texture, photorealistic, 8k resolution, cinematic drama movie still, no text on image"
    },
    {
        "id": 2,
        "dir": "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文/02_已发布/2026-09-10_kurudi_si_kufika",
        "title_sw": "KURUDI SI KUFIKA",
        "title_en": "RETURNING IS NOT ARRIVING",
        "author": "Amara Nuru",
        "layout": "bottom",
        "font_family": "arial_black",
        "title_color": (224, 247, 250),      # Cyan Ice
        "stroke_color": (10, 15, 25),
        "prompt": "Vertical 3:4 portrait book cover photo. A determined young 24yo African woman in a casual denim jacket holding a travel duffel bag stepping down from a bright yellow bajaji auto-rickshaw in a bustling street market in Dar es Salaam at dusk, evening rain drizzle reflections on wet asphalt, colorful neon fruit stall lights, motorcycle riders in background, photorealistic, 8k resolution, cinematic urban depth of field, no text on image"
    },
    {
        "id": 3,
        "dir": "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文/02_已发布/2026-09-15_jina_lililofutwa_shuleni",
        "title_sw": "JINA LILILOFUTWA SHULENI",
        "title_en": "THE NAME ERASED AT SCHOOL",
        "author": "Rehema Kisiwa",
        "layout": "top",
        "font_family": "baskerville",
        "title_color": (255, 253, 240),      # Ivory
        "stroke_color": (20, 20, 30),
        "prompt": "Vertical 3:4 portrait book cover photo. A worried African female high school teacher with neat braided hair holding student report folders, standing in a sunlit school corridor looking at an official wooden notice board with a crossed-out name in red ink, two students in green school uniforms whispering in background, photorealistic, 8k resolution, bright daylight through windows, suspenseful atmosphere, no text on image"
    },
    {
        "id": 4,
        "dir": "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文/02_已发布/2026-09-15_mlango_wa_nyumba",
        "title_sw": "MLANGO WA NYUMBA",
        "title_en": "THE HOUSE DOOR",
        "author": "Rashid Pwani",
        "layout": "top",
        "font_family": "impact",
        "title_color": (245, 158, 11),       # Fiery Copper
        "stroke_color": (15, 15, 15),
        "prompt": "Vertical 3:4 portrait book cover photo. A young African man in a dark hooded rain jacket standing outside a weathered coastal Swahili house with a distinctive distressed red wooden door, a heavy broken brass padlock hanging loose, dark stormy ocean clouds gathering overhead, palm trees swaying in wind, photorealistic, 8k, dramatic shadows, no text on image"
    },
    {
        "id": 5,
        "dir": "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文/02_已发布/2026-09-15_nyumba_ya_hesabu",
        "title_sw": "NYUMBA YA HESABU",
        "title_en": "THE ACCOUNTING HOUSE",
        "author": "Imani Zawadi",
        "layout": "bottom",
        "font_family": "trebuchet",
        "title_color": (240, 253, 244),      # Mint Ice
        "stroke_color": (10, 25, 47),
        "prompt": "Vertical 3:4 portrait book cover photo. An intense African male accountant in a white shirt and suspenders working late night in a high-rise glass skyscraper office, illuminated computer screens with financial spreadsheets reflecting in the glass, stacks of audit documents on desk, glowing Nairobi city skyline bokeh at night, photorealistic, 8k resolution, no text on image"
    },
    {
        "id": 6,
        "dir": "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文/02_已发布/2026-09-17_makubaliano_ya_siri",
        "title_sw": "MAKUBALIANO YA SIRI",
        "title_en": "THE SECRET AGREEMENT",
        "author": "Layla Pendo",
        "layout": "top",
        "font_family": "didot",
        "title_color": (248, 250, 252),      # Platinum
        "stroke_color": (15, 23, 42),
        "prompt": "Vertical 3:4 portrait book cover photo. Two sharp African executives—an ambitious woman in an emerald green blazer and a seasoned male CEO in a grey bespoke suit—standing on opposite sides of a polished dark conference table, both with hands on a signed contract paper with a red seal, warm modern boardroom lighting, dramatic confrontation, photorealistic, 8k, no text on image"
    },
    {
        "id": 7,
        "dir": "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文/02_已发布/2026-09-17_mizigo_kabla_ya_harusi",
        "title_sw": "MIZIGO KABLA YA HARUSI",
        "title_en": "LUGGAGE BEFORE THE WEDDING",
        "author": "Neema Mwangaza",
        "layout": "bottom",
        "font_family": "georgia",
        "title_color": (253, 230, 138),      # Champagne Gold
        "stroke_color": (20, 10, 10),
        "prompt": "Vertical 3:4 portrait book cover photo. A beautiful African bride in an ornate white lace bridal gown with delicate jewelry standing in a grand decorated house hallway, looking in utter shock at two packed vintage leather suitcases standing abandoned near the open front door, rain pouring outside as car tail-lights disappear, photorealistic, 8k, movie still, no text on image"
    },
    {
        "id": 8,
        "dir": "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文/02_已发布/2026-09-17_simu_isiyokuwa_mkononi",
        "title_sw": "SIMU ISIYOKUWA MKONONI",
        "title_en": "THE CALL OUT OF REACH",
        "author": "Baraka Nuru",
        "layout": "top",
        "font_family": "impact",
        "title_color": (254, 240, 138),      # Electric Neon Yellow
        "stroke_color": (5, 5, 10),
        "prompt": "Vertical 3:4 portrait book cover photo. Low angle close-up of a young African man in a dark jacket desperately lunging forward on a rain-drenched city pavement, reaching for a glowing smartphone lying in a water puddle with a brightly lit incoming call screen, blurred streetlights and car headlights reflected in the water, photorealistic, 8k, no text on image"
    },
    {
        "id": 9,
        "dir": "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文/02_已发布/2026-09-18_binti_aliyekuwa_mpwa",
        "title_sw": "BINTI ALIYEKUWA MPWA",
        "title_en": "THE DAUGHTER WHO WAS A NIECE",
        "author": "Kito Bahari",
        "layout": "top",
        "font_family": "baskerville",
        "title_color": (255, 251, 235),      # Warm Cream
        "stroke_color": (25, 20, 15),
        "prompt": "Vertical 3:4 portrait book cover photo. An elegant 50yo African matriarch sitting by a sunny veranda holding a faded sepia photograph, looking with tearful surprise toward an 18yo African girl standing in the garden under a blooming purple jacaranda tree, golden afternoon sun rays, rich emotional depth, photorealistic, 8k resolution, no text on image"
    },
    {
        "id": 10,
        "dir": "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文/02_已发布/2026-09-18_kamisheni_ya_familia",
        "title_sw": "KAMISHENI YA FAMILIA",
        "title_en": "THE FAMILY COMMISSION",
        "author": "Taji Amani",
        "layout": "bottom",
        "font_family": "impact",
        "title_color": (255, 237, 213),      # Warm Bright Orange
        "stroke_color": (30, 15, 10),
        "prompt": "Vertical 3:4 portrait book cover photo. Four African relatives arguing intensely around a living room dining table, an aggressive elder brother shouting and pointing at bank cash envelopes and phone transaction screens on the table, while the young protagonist stands firm in the center with crossed arms, dramatic indoor tungsten lighting, photorealistic, 8k, no text on image"
    },
    {
        "id": 11,
        "dir": "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文/02_已发布/2026-09-19_deni_lisilokuwa_langu",
        "title_sw": "DENI LISILOKUWA LANGU",
        "title_en": "THE DEBT THAT WAS NOT MINE",
        "author": "Soma Originals",
        "layout": "top",
        "font_family": "trebuchet",
        "title_color": (251, 191, 36),       # Amber Gold
        "stroke_color": (15, 15, 15),
        "prompt": "Vertical 3:4 portrait book cover photo. A hardworking young African auto mechanic in blue overalls in a sunlit busy garage workshop, holding a red-stamped bank foreclosure debt notice with disbelief, two corporate debt recovery men in suits standing sternly in the background near a vintage car, photorealistic, 8k, cinematic realism, no text on image"
    },
    {
        "id": 12,
        "dir": "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文/02_已发布/2026-09-20_barua_ya_uhamisho",
        "title_sw": "BARUA YA UHAMISHO",
        "title_en": "THE TRANSFER LETTER",
        "author": "Idris Mwangaza",
        "layout": "bottom",
        "font_family": "copperplate",
        "title_color": (241, 245, 249),      # Crisp Silver White
        "stroke_color": (15, 23, 42),
        "prompt": "Vertical 3:4 portrait book cover photo. A strong African woman in an elegant African blazer holding a stamped official government transfer envelope outside a grand municipal government building with stone pillars, rainy overcast sky, official government cars arriving, photorealistic, 8k, stately composition, no text on image"
    },
    {
        "id": 13,
        "dir": "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文/02_已发布/2026-09-20_kesho_benki_itajua",
        "title_sw": "KESHO BENKI ITAJUA",
        "title_en": "TOMORROW THE BANK WILL KNOW",
        "author": "Omari Kivuli",
        "layout": "top",
        "font_family": "georgia",
        "title_color": (255, 255, 255),      # Pure Moonlit White
        "stroke_color": (6, 78, 59),         # Deep Emerald
        "prompt": "Vertical 3:4 portrait book cover photo. An African couple in their modern apartment living room at 2 AM, the husband pacing by the window on his phone looking stressed, while his wife sits under a single warm desk lamp closely checking bank mortgage contracts with a red pen, city skyline dark outside, photorealistic, 8k, no text on image"
    },
    {
        "id": 14,
        "dir": "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文/02_已发布/2026-09-21_dhamana_iliyogeuka_deni",
        "title_sw": "DHAMANA ILIYOGEUKA DENI",
        "title_en": "BAIL THAT TURNED INTO DEBT",
        "author": "Malaika Mtoni",
        "layout": "top",
        "font_family": "baskerville",
        "title_color": (250, 204, 21),       # Bright Gold
        "stroke_color": (20, 20, 20),
        "prompt": "Vertical 3:4 portrait book cover photo. A worried African mother in traditional patterned kanga holding a green official bail receipt in a bustling colonial courthouse corridor, lawyers with briefcases rushing past, police officers in background, high marble arches, photorealistic, 8k resolution, emotional drama, no text on image"
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

def generate_book_covers_with_codex(book):
    book_dir = book["dir"]
    base_art_path = os.path.join(book_dir, "raw_ai_art.png")
    
    print(f"\n=======================================================")
    print(f"Processing Book {book['id']}/14: {book['title_sw']} / {book['title_en']}")
    print(f"Target Dir: {book_dir}")
    print(f"Prompt: {book['prompt']}")
    
    # 1. Call Codex CLI with built-in image_gen
    codex_instruction = (
        f"Generate a vertical 3:4 portrait orientation photorealistic image using the built-in image_gen tool: "
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
            print(f"Error: Could not obtain generated image for Book {book['id']}")
            return False
            
    # 2. Render SW cover
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
    
    # 3. Render EN cover
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
    
    # 4. Upload immediately via upload-soma-books.mjs
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
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        if ".." in arg:
            start_id, end_id = map(int, arg.split(".."))
            target_books = [b for b in BOOKS if start_id <= b["id"] <= end_id]
        else:
            target_id = int(arg)
            target_books = [b for b in BOOKS if b["id"] == target_id]
    else:
        target_books = BOOKS
        
    for b in target_books:
        success = generate_book_covers_with_codex(b)
        if not success:
            print(f"Failed at book {b['id']}")
            sys.exit(1)
