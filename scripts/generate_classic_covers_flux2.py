#!/usr/bin/env python3
import os
import sys
import json
import shutil
import subprocess
import numpy as np
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

MOBILE_BASE = "/Users/yvoche/AI开发/000.非洲最终正文/0.2英文经典手机版"
ORIG_BASE = "/Users/yvoche/AI开发/000.非洲最终正文/0.1英文经典"
MFLUX_BIN = "/Users/yvoche/omlx-venv/bin/mflux-generate-flux2"
MODEL_NAME = "/Users/yvoche/omlx-models/flux2-klein-4b"
USER_LOGO_PATH = "/Users/yvoche/.gemini/antigravity/brain/02f10089-de3f-4570-9376-b94cf1c4c6d1/.user_uploaded/media_1786245052831.jpg"

BOOK_PROMPTS = {
    "A Christmas Carol": ("Ebenezer Scrooge looking out a frosty window in Victorian London on Christmas Eve, glowing ghost of Christmas past, dark moody cinematic lighting, golden candlelight reflections, masterpiece bestseller book cover art, 8k resolution", "Charles Dickens"),
    "A Study in Scarlet": ("Sherlock Holmes holding a magnifying glass by gaslight, blood red initials RACHE written on a dark wet brick wall, foggy 221B Baker Street London, mysterious detective cover", "Arthur Conan Doyle"),
    "A Tale of Two Cities": ("Dramatic panoramic view of Paris and London skyline under stormy skies, a silhouette of a guillotine against a turbulent crimson sunset, epic historical portrait", "Charles Dickens"),
    "Alice's Adventures in Wonderland": ("Alice falling down a surreal rabbit hole filled with floating golden pocket watches, playing cards, and glowing potion bottles, whimsical fantasy illustration art", "Lewis Carroll"),
    "Anna Karenina": ("A beautiful noble Russian woman in a black velvet coat standing on a snowy train platform at night, steam rising from a vintage locomotive, dramatic romantic lighting", "Leo Tolstoy"),
    "Anne of Green Gables": ("A young girl with red braids looking over green rolling hills of Prince Edward Island under a bright sunny sky with blooming apple blossoms, warm nostalgic watercolor", "L. M. Montgomery"),
    "Anthem": ("A solitary glowing light bulb held by a figure in a dark utilitarian futuristic hall, high contrast dystopian lighting, stark dramatic composition", "Ayn Rand"),
    "Around the World in Eighty Days": ("A majestic hot air balloon flying over diverse global landmarks, Pyramids and Taj Mahal under a golden sunrise, vintage steampunk adventure cover", "Jules Verne"),
    "Beowulf": ("A heroic warrior in rune-engraved armor fighting a glowing mythical dragon in a dark misty Scandinavian cavern, epic high fantasy illustration", "Anonymous"),
    "Beyond Good and Evil": ("A philosophical silhouette standing on a high mountain peak at dusk, dramatic contrast of blinding light and deep shadows, abstract conceptual cover art", "Friedrich Nietzsche"),
    "Crime and Punishment": ("A brooding man in Saint Petersburg walking down a narrow moonlit cobblestone alleyway, shadow casting long, intense psychological thriller style", "Fyodor Dostoevsky"),
    "David Copperfield": ("A young boy looking toward a coastal English town at dawn, warm vintage Victorian illustration style", "Charles Dickens"),
    "Don Quixote": ("A noble knight on a lean horse tilting his lance at giant windmills on a sun-drenched Spanish plain, vibrant painterly style", "Miguel de Cervantes"),
    "Dracula": ("A Gothic castle perched on a dark Transylvanian cliff under a full moon, red bats flying in the dark stormy sky, classic horror art", "Bram Stoker"),
    "Emma": ("A charming Regency era English lady strolling through a sunlit rose garden in Highbury, elegant romantic portrait", "Jane Austen"),
    "Frankenstein": ("Dr Frankenstein's monster illuminated by a flash of green lightning inside a gothic laboratory, dark gothic horror art", "Mary Shelley"),
    "Great Expectations": ("Pip standing before Miss Havisham's cobwebbed dusty manor house, misty marshlands, Victorian gothic aesthetic", "Charles Dickens"),
    "Grimms' Fairy Tales": ("A dark enchanted forest with a glowing cottage, red riding hood and magical creatures in moonlight, fairytale illustration", "Brothers Grimm"),
    "Gulliver's Travels": ("A giant man tied down by tiny ropes on a beach of tiny people, vintage sea adventure illustration", "Jonathan Swift"),
    "Heart of Darkness": ("A steamboat navigating a dark misty tropical river deep inside a dense jungle, ominous atmospheric lighting", "Joseph Conrad"),
    "Jane Eyre": ("Thornfield Hall burning in the night sky, a silhouette of a stubborn woman standing in the windswept moor, gothic romance", "Charlotte Brontë"),
    "Les Misérables": ("A young girl Cosette holding a broom, behind her the French tricolor flag on a barricade in Paris, epic dramatic art", "Victor Hugo"),
    "Leviathan": ("A giant mythical sea-monster rising from dark stormy oceans, epic biblical leviathan fantasy art", "Thomas Hobbes"),
    "Little Women": ("Four sisters gathered around a cozy fireplace in a 19th-century New England living room, warm heartwarming vintage art", "Louisa May Alcott"),
    "Mansfield Park": ("An elegant grand English country estate surrounded by green manicured lawns under a soft morning sky", "Jane Austen"),
    "Metamorphosis": ("A solitary glowing light illuminating a quiet bedroom where a man turns into a giant beetle shadow, surreal minimalist art", "Franz Kafka"),
    "Middlemarch": ("A quiet Victorian English town with church spires in golden afternoon light, elegant classic literature cover", "George Eliot"),
    "Moby-Dick": ("Captain Ahab standing on the deck of a wooden ship facing a majestic massive white whale leaping from stormy seas", "Herman Melville"),
    "Narrative of the Life of Frederick Douglass": ("A powerful silhouette of a man breaking heavy chains against a golden dawn sky, inspiring freedom artwork", "Frederick Douglass"),
    "Northanger Abbey": ("A gothic abbey surrounded by swirling mist under moonlight, young woman holding a lantern, Regency mystery", "Jane Austen"),
    "Oliver Twist": ("A thin Victorian orphan boy holding an empty bowl in a dark London workhouse, dramatic Dickensian art", "Charles Dickens"),
    "Persuasion": ("An Anne Elliot walking along the windswept coastal cliffs of Lyme Regis looking out at the sea, romantic atmosphere", "Jane Austen"),
    "Pride and Prejudice": ("Elizabeth Bennet and Mr Darcy standing in a misty English park at dawn, Regency romance aesthetic", "Jane Austen"),
    "Sense and Sensibility": ("Two sisters standing on a picturesque grassy hill overlooking a cottage in Devonshire, soft pastel watercolor", "Jane Austen"),
    "Siddhartha": ("A serene monk meditating under a bodhi tree by a calm river at sunrise, spiritual golden glow art", "Hermann Hesse"),
    "Tess of the d'Urbervilles": ("A young woman standing among ancient monoliths at Stonehenge at sunrise, tragic romantic landscape", "Thomas Hardy"),
    "The Adventures of Huckleberry Finn": ("Two boys on a wooden raft floating down the wide Mississippi River under a star-filled night sky", "Mark Twain"),
    "The Adventures of Sherlock Holmes": ("Sherlock Holmes profile with pipe and deerstalker hat, misty Baker Street in 221B London background", "Arthur Conan Doyle"),
    "The Adventures of Tom Sawyer": ("A whitewashed wooden fence under bright summer sun, a young boy with a straw hat and paintbrush", "Mark Twain"),
    "The Awakening": ("A woman swimming freely into the warm turquoise ocean waters at dusk, liberation atmosphere", "Kate Chopin"),
    "The Blue Fairy Book": ("A magical blue fairytale castle with glowing stars, fairies and mythical dragons, rich vibrant illustration", "Andrew Lang"),
    "The Brothers Karamazov": ("Three brothers silhouettes before an old Russian Orthodox church under dramatic stormy skies", "Fyodor Dostoevsky"),
    "The Call of the Wild": ("A majestic wild wolf standing atop a snowy mountain peak howling at the Northern Lights in Alaska", "Jack London"),
    "The Count of Monte Cristo": ("A dark figure escaping from the Château d'If island prison into stormy ocean waters with glowing treasure, epic revenge cover", "Alexandre Dumas"),
    "The Enchanted April": ("A sunny Italian castle overlooking the Mediterranean Sea blooming with wisteria and flowers", "Elizabeth von Arnim"),
    "The Great Gatsby": ("A glowing green light across the dark bay, Art Deco golden gates, glamorous 1920s Long Island mansion", "F. Scott Fitzgerald"),
    "The Hound of the Baskervilles": ("A terrifying glowing phantom hound prowling the dark foggy Dartmoor moors under a full moon", "Arthur Conan Doyle"),
    "The House of the Seven Gables": ("An ancient dark timbered New England house with seven gables under a moody violet dusk sky", "Nathaniel Hawthorne"),
    "The Iliad": ("Trojan horse outside the towering stone walls of ancient Troy during a fiery battle, epic mythology art", "Homer"),
    "The Invisible Man": ("Bandages, dark sunglasses and a wide-brim hat floating above a coat with no visible face, eerie sci-fi mystery", "H. G. Wells"),
    "The Jungle Book": ("Mowgli sitting with a black panther Bagheera and a brown bear Baloo in a sunlit Indian jungle", "Rudyard Kipling"),
    "The King in Yellow": ("A shadowy figure wearing a yellow tattered robe holding a mysterious theater mask, cosmic horror art", "Robert W. Chambers"),
    "The Life and Adventures of Robinson Crusoe": ("A shipwrecked man standing on a deserted tropical island beach looking at footprint in the sand", "Daniel Defoe"),
    "The Memoires of Sherlock Holmes": ("Sherlock Holmes and Professor Moriarty grappling at the edge of the roaring Reichenbach Falls", "Arthur Conan Doyle"),
    "The Moonstone": ("A glowing yellow diamond resting on a dark velvet cushion surrounded by Victorian shadows, jewel robbery mystery", "Wilkie Collins"),
    "The Mysterious Affair at Styles": ("A vintage glass bottle of poison and a magnifying glass on a mahogany manor table, Agatha Christie mystery", "Agatha Christie"),
    "The Odyssey": ("Odysseus on a wooden galley ship sailing past roaring sea monsters and sirens in the Mediterranean", "Homer"),
    "The Phantom of the Opera": ("A man wearing a half white mask in the dark underground catacombs beneath the Paris Opera house, candle lit", "Gaston Leroux"),
    "The Picture of Dorian Gray": ("A handsome young man standing beside a decaying, sinister portrait of himself in a dark Victorian room", "Oscar Wilde"),
    "The Prince": ("A Renaissance ruler holding a golden crown and dagger in a Florentine palace, Machiavellian political theme", "Niccolò Machiavelli"),
    "The Red Fairy Book": ("A magical red fairy tale castle surrounded by glowing enchanted forest flowers and knights", "Andrew Lang"),
    "The Republic": ("Plato's cave with shadows projected on a stone wall by a bright fire behind, philosophical masterpiece", "Plato"),
    "The Return of Sherlock Holmes": ("Sherlock Holmes appearing out of the London fog under a streetlamp, dark atmospheric detective cover", "Arthur Conan Doyle"),
    "The Scarlet Letter": ("A glowing red letter A embroidered on a dark Victorian dress, moody New England puritan atmosphere", "Nathaniel Hawthorne"),
    "The Secret Garden": ("A hidden wooden door covered in ivy opening into a secret lush flower garden in full bloom", "Frances Hodgson Burnett"),
    "The Strange Case of Dr Jekyll and Mr Hyde": ("A dual portrait of a gentle Victorian doctor splitting into a monstrous dark shadow in a laboratory", "Robert Louis Stevenson"),
    "The Time Machine": ("A Victorian brass time machine with glowing dials traveling through a temporal vortex", "H. G. Wells"),
    "The Turn of the Screw": ("A young governess looking at a ghostly figure standing atop a dark manor tower at dusk", "Henry James"),
    "The War of the Worlds": ("Massive alien tripod war machines walking across a burning London landscape shooting heat rays, sci-fi epic", "H. G. Wells"),
    "The Woman in White": ("A mysterious ghostly woman dressed in white standing on a dark country road by moonlight", "Wilkie Collins"),
    "The Wonderful Wizard of Oz": ("Dorothy and friends walking along the Yellow Brick Road toward the glowing Emerald City", "L. Frank Baum"),
    "The Works of Edgar Allan Poe": ("A black raven perched on a bust of Pallas above a chamber door, dark gothic poetry atmosphere", "Edgar Allan Poe"),
    "The Works of Edgar Allan Poe - Volume 1": ("A tell-tale heart beating beneath wooden floorboards, dark macabre Edgar Allan Poe aesthetic", "Edgar Allan Poe"),
    "The Works of Edgar Allan Poe - Volume 2": ("A golden scarab beetle floating over an old treasure map in a dimly lit study", "Edgar Allan Poe"),
    "The Yellow Fairy Book": ("A golden magical castle in the sky with glowing stars and fairytale creatures", "Andrew Lang"),
    "Through the Looking-Glass": ("A young Victorian girl Alice standing in front of a giant ornate silver framed oval mirror, looking through into a magical surreal surrealist landscape of giant marble chessboards and floating chess pieces, dramatic volumetric moonlight, silver and gold reflections, masterpiece bestseller book cover art, 8k resolution", "Lewis Carroll"),
    "Thus Spake Zarathustra": ("Zarathustra standing atop a mountain peak facing the rising golden sun, eagles soaring, epic philosophical art", "Friedrich Nietzsche"),
    "Treasure Island": ("A pirate holding a skull treasure map on a tropical beach with a three-masted pirate ship", "Robert Louis Stevenson"),
    "Ulysses": ("A modern Dublin cityscape at blue hour reflected in the River Liffey, literary modernist cover art", "James Joyce"),
    "Walden": ("A small wooden cabin beside a crystal clear calm lake surrounded by autumnal trees, peaceful nature art", "Henry David Thoreau"),
    "War and Peace": ("Napoleon's army marching across snowy Russian battlefields with burning Moscow in the background, epic historical masterpiece", "Leo Tolstoy")
}

def get_circular_logo(size=76):
    user_logo = Image.open(USER_LOGO_PATH).convert('RGBA')
    logo_sq = user_logo.resize((size * 4, size * 4), Image.Resampling.LANCZOS)
    mask = Image.new('L', (size * 4, size * 4), 0)
    draw_mask = ImageDraw.Draw(mask)
    draw_mask.ellipse((0, 0, size * 4, size * 4), fill=255)
    logo_sq.putalpha(mask)
    return logo_sq.resize((size, size), Image.Resampling.LANCZOS)

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

    # DYNAMIC COLOR SELECTION (White vs Gold)
    if target_lum < 110:
        # Dark background -> Pure Crisp White Snell Calligraphy with Silver/Gold highlight
        font_fill = (255, 255, 255, 255)
        stroke_color = (15, 20, 30, 255)
        inner_highlight = (245, 240, 230, 255)
        author_color = (245, 230, 185, 255) # Pale Gold Author
    else:
        # Medium/Light background -> Metallic Gold Snell Calligraphy
        font_fill = (255, 215, 80, 255)
        stroke_color = (80, 50, 10, 255)
        inner_highlight = (255, 245, 200, 255)
        author_color = (255, 235, 170, 255) # Gold Author

    return position, font_fill, stroke_color, inner_highlight, author_color

def render_smart_title_snell(draw, title_str, start_y, W_2x, max_width, font_fill, stroke_color, inner_highlight):
    words = title_str.split()

    # Auto-scaling font size with safe margin bounds
    for font_sz in range(110, 45, -5):
        font = ImageFont.truetype('/System/Library/Fonts/Supplemental/SnellRoundhand.ttc', font_sz)

        lines = []
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

                # 3D Snell Calligraphy with Dynamic Color (White vs Gold)
                draw.text((line_x + 3, line_y + 3), line, font=font, fill=(0, 0, 0, 240), stroke_width=4, stroke_fill=(0, 0, 0, 255))
                draw.text((line_x, line_y), line, font=font, fill=font_fill, stroke_width=3, stroke_fill=stroke_color)
                draw.text((line_x - 1, line_y - 1), line, font=font, fill=inner_highlight)

            return last_line_bottom

    return start_y + 100

def composite_cover_2x(raw_img_path, title, author, output_path):
    cover = Image.open(raw_img_path).convert('RGBA')
    bbox = cover.getbbox()
    cover_cropped = cover.crop(bbox)

    # 2x Super-Sampling Canvas: 1024 x 1536
    W_2x, H_2x = 1024, 1536
    cover_full = cover_cropped.resize((W_2x, H_2x), Image.Resampling.LANCZOS).convert('RGBA')

    overlay = Image.new('RGBA', (W_2x, H_2x), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # 1. Top Left: Circular Logo + SomaNovel
    logo_circular = get_circular_logo(76)
    logo_x, logo_y = 32, 32
    overlay.paste(logo_circular, (logo_x, logo_y), logo_circular)

    font_snell_logo = ImageFont.truetype('/System/Library/Fonts/Supplemental/SnellRoundhand.ttc', 50)
    font_author = ImageFont.truetype('/System/Library/Fonts/Supplemental/Georgia Bold.ttf', 36)
    font_bottom_crisp = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 30)

    text_x = logo_x + 76 + 16
    bbox_s = font_snell_logo.getbbox('SomaNovel')
    text_h = bbox_s[3] - bbox_s[1]
    text_y = logo_y + (76 - text_h) // 2 - 4

    for dx, dy in [(0,0), (2,0), (0,2)]:
        draw.text((text_x + dx + 2, text_y + dy + 2), 'SomaNovel', font=font_snell_logo, fill=(0, 0, 0, 220))
        draw.text((text_x + dx, text_y + dy), 'SomaNovel', font=font_snell_logo, fill=(245, 230, 185, 255))

    # 2. Dynamic Position & Palette Selection (White vs Gold)
    position, font_fill, stroke_color, inner_highlight, author_color = analyze_layout_and_palette(cover_full)
    MAX_W = W_2x - 80 # Safe margin boundary (40px padding)

    if position == 'bottom':
        start_y = 1020
    else:
        start_y = 130

    # Draw Title (Dynamic Snell Calligraphy with White/Gold Palette)
    last_title_bottom = render_smart_title_snell(draw, title, start_y, W_2x, MAX_W, font_fill, stroke_color, inner_highlight)

    # Draw Author BELOW Title with 44px Elegant Breathing Space!
    author_str = author.upper()
    bbox_a = font_author.getbbox(author_str)
    author_w = bbox_a[2] - bbox_a[0]
    author_x = (W_2x - author_w) // 2
    author_y = last_title_bottom + 44

    draw.text((author_x, author_y), author_str, font=font_author, fill=author_color, stroke_width=4, stroke_fill=(10, 10, 15, 255))

    # 3. Bottom Watermark
    bottom_text = 'SOMANOVEL  •  FREE MOBILE READS  •  WWW.SOMANOVEL.UK'
    bbox_b = font_bottom_crisp.getbbox(bottom_text)
    bottom_w = bbox_b[2] - bbox_b[0]
    bottom_x = (W_2x - bottom_w) // 2
    bottom_y = H_2x - 46

    draw.text((bottom_x, bottom_y), bottom_text, font=font_bottom_crisp, fill=(255, 255, 255, 255), stroke_width=2, stroke_fill=(0, 0, 0, 255))

    final_img_2x = Image.alpha_composite(cover_full, overlay).convert('RGB')
    final_img = final_img_2x.resize((512, 768), Image.Resampling.LANCZOS)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    final_img.save(output_path, quality=99)

def clear_old_covers():
    print("🗑️ 正在物理清空旧版本封面文件...")
    cleared = 0
    dirs = [d for d in os.listdir(MOBILE_BASE) if os.path.isdir(os.path.join(MOBILE_BASE, d)) and not d.startswith('.')]
    for d in dirs:
        clean_name = d.replace("mobile_", "")
        mob_c = os.path.join(MOBILE_BASE, d, f"{d}_cover.jpg")
        orig_c = os.path.join(ORIG_BASE, clean_name, f"{clean_name}_cover.jpg")
        if os.path.exists(mob_c):
            os.remove(mob_c)
            cleared += 1
        if os.path.exists(orig_c):
            os.remove(orig_c)
            cleared += 1
    print(f" ✅ 旧版封面物理清理完成 (共清理 {cleared} 个文件)！\n")

def generate_all_covers():
    clear_old_covers()

    dirs = [d for d in os.listdir(MOBILE_BASE) if os.path.isdir(os.path.join(MOBILE_BASE, d)) and not d.startswith('.')]
    dirs.sort()

    total = len(dirs)
    print(f"==================================================")
    print(f" 🚀 启动全量 81 部名著【丰富细节 Prompt + Snell 动态白/金花体 + 安全边距自适应】重制")
    print(f"==================================================\n")

    success_count = 0
    fail_count = 0

    for idx, folder_name in enumerate(dirs, 1):
        clean_name = folder_name.replace("mobile_", "")
        prompt, author = BOOK_PROMPTS.get(clean_name, (f"{clean_name} literary masterpiece, epic cinematic scene, highly detailed", "Classic Literature"))

        mobile_folder = os.path.join(MOBILE_BASE, folder_name)
        orig_folder = os.path.join(ORIG_BASE, clean_name)

        target_img_mobile = os.path.join(mobile_folder, f"{folder_name}_cover.jpg")
        target_img_orig = os.path.join(orig_folder, f"{clean_name}_cover.jpg") if os.path.exists(orig_folder) else None

        print(f"[{idx:2d}/{total}] 🎨 丰富 FLUX.2 生图 & 动态白/金 Snell 花体排版: {clean_name} ({author}) ...", end="", flush=True)

        temp_img = f"/tmp/clean_master_raw_{idx}.png"
        cmd = [
            MFLUX_BIN,
            "--model", MODEL_NAME,
            "--prompt", prompt,
            "--width", "512",
            "--height", "768",
            "--steps", "4",
            "--output", temp_img
        ]

        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode == 0 and os.path.exists(temp_img):
            composite_cover_2x(temp_img, clean_name, author, target_img_mobile)
            if target_img_orig:
                shutil.copy(target_img_mobile, target_img_orig)
            os.remove(temp_img)

            sz_kb = os.path.getsize(target_img_mobile) / 1024
            print(f" ✅ 完成 ({sz_kb:.1f} KB)")
            success_count += 1
        else:
            print(f" ❌ 失败: {res.stderr.strip()[:100]}")
            fail_count += 1

    print(f"\n==================================================")
    print(f" 🎉 全部 {success_count} 部名著的顶级美感极清动态白/金封面全新打包归盘完成！")
    print(f"==================================================")

if __name__ == "__main__":
    generate_all_covers()
