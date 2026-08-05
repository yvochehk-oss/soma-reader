#!/usr/bin/env python3
"""
Rebuild full 6 books dataset for booksData.ts seamlessly with QUICK_NAVIGATION_ITEMS.
"""

import os
import json
import re

BASE_NOVELS_DIR = "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文"

def parse_markdown_chapters(file_path):
    if not file_path or not os.path.exists(file_path):
        return []
    with open(file_path, "r", encoding="utf-8") as f:
        text = f.read()

    raw_chapters = re.split(r'\n(?=# (?:Chapter|Sura ya)\s+)', text)
    chapters = []
    
    for idx, raw in enumerate(raw_chapters):
        if not raw.strip():
            continue
        lines = raw.strip().split("\n")
        title_line = lines[0].strip()
        content_lines = lines[1:]
        
        clean_title = re.sub(r'^#+\s*', '', title_line).strip()
        content = "\n".join(content_lines).strip()
        
        if content:
            chapters.append({
                "number": idx + 1,
                "title": clean_title,
                "content": content
            })
    return chapters

def process_book_dir(folder_path, book_id, title_en, title_sw, author, category, tags, desc_en, desc_sw, cover_en, cover_sw):
    if not os.path.exists(folder_path):
        print(f"⚠️ Folder not found: {folder_path}")
        return None
    
    files = os.listdir(folder_path)
    en_file = next((os.path.join(folder_path, f) for f in files if ("en" in f.lower() or "english" in f.lower()) and f.endswith(".md")), None)
    sw_file = next((os.path.join(folder_path, f) for f in files if ("sw" in f.lower() or "swahili" in f.lower()) and f.endswith(".md")), None)
    
    ch_en = parse_markdown_chapters(en_file)
    ch_sw = parse_markdown_chapters(sw_file)
    
    max_chapters = max(len(ch_en), len(ch_sw))
    merged_chapters = []
    
    for i in range(max_chapters):
        item_en = ch_en[i] if i < len(ch_en) else {"title": f"Chapter {i+1}", "content": ""}
        item_sw = ch_sw[i] if i < len(ch_sw) else {"title": f"Sura ya {i+1}", "content": ""}
        
        merged_chapters.append({
            "id": f"{book_id}-ch{i+1}",
            "number": i + 1,
            "title": item_en["title"],
            "titleSwahili": item_sw["title"],
            "releaseDate": "2026-08-02",
            "wordCount": len(item_en["content"].split()),
            "content": item_en["content"],
            "contentSwahili": item_sw["content"]
        })

    return {
        "id": book_id,
        "title": title_en,
        "titleSwahili": title_sw,
        "author": author,
        "category": category,
        "rating": 9.9,
        "heatMetric": "9.9",
        "description": desc_en,
        "descriptionSwahili": desc_sw,
        "coverImage": f"/covers/{cover_en}",
        "bannerImage": f"/covers/{cover_en}",
        "status": "Hot",
        "isEditorChoice": True,
        "isBilingualAvailable": True,
        "publishedYear": "2026",
        "chaptersCount": len(merged_chapters),
        "tags": tags,
        "chapters": merged_chapters
    }

# 1. Book 5: The Last Seven Minutes
b5 = process_book_dir(
    folder_path=os.path.join(BASE_NOVELS_DIR, "Dakika Saba za Mwisho"),
    book_id="the-last-seven-minutes",
    title_en="The Last Seven Minutes",
    title_sw="Dakika Saba za Mwisho",
    author="Amara Nuru",
    category="Thriller",
    tags=["Medical Thriller", "Nairobi Emergency", "Justice", "High Tension"],
    desc_en="At 02:13 AM in Nairobi Emergency Ward, Dr. Wanjiku Naliaka fights to save the wealthy man responsible for her mother's death while unravelling a high-tech medical conspiracy.",
    desc_sw="Saa 8:13 usiku katika Wodi ya Dharura ya Nairobi, Dk. Wanjiku Naliaka anapambana kuokoa tajiri aliyesababisha kifo cha mama yake huku akifichua njama ya kiteknolojia.",
    cover_en="the_last_seven_minutes_en.jpg",
    cover_sw="dakika_saba_za_mwisho_sw.jpg"
)

# 2. Book 6: I Returned Before the Wedding
b6 = process_book_dir(
    folder_path=os.path.join(BASE_NOVELS_DIR, "Nilirudi Kabla ya Harusi"),
    book_id="i-returned-before-the-wedding",
    title_en="I Returned Before the Wedding",
    title_sw="Nilirudi Kabla ya Harusi",
    author="Nia Kendi",
    category="Romance",
    tags=["Revenge Romance", "High Society", "Limuru Fire", "Rebirth & Justice"],
    desc_en="Trapped in a warehouse fire set by her husband on the eve of his secret high-society wedding, Zawadi Muthoni escapes and returns to reclaim her empire.",
    desc_sw="Akiwa amenasa katika moto wa ghala uliowekwa na mume wake kabla ya harusi ya siri, Zawadi Muthoni anaponyoka na kurudi kudai milki yake.",
    cover_en="i_returned_before_the_wedding_en.jpg",
    cover_sw="nilirudi_kabla_ya_harusi_sw.jpg"
)

# 3. Book 1: Voices Beneath the Baobab
b1 = process_book_dir(
    folder_path=os.path.join(BASE_NOVELS_DIR, "Sauti_Chini_ya_Mbuyu_complete_project_v2_1-2"),
    book_id="voices-beneath-the-baobab",
    title_en="Voices Beneath the Baobab",
    title_sw="Sauti Chini ya Mbuyu",
    author="Zahra Bahari",
    category="Urban Fantasy",
    tags=["Baobab Secrets", "Coastal Kenya", "Ancestral Magic", "Swahili Fantasy"],
    desc_en="Deep in the coastal forests of Kenya, an ancient Baobab tree begins to whisper long-forgotten secrets of ancestral power, binding a young woman's destiny to a hidden sacred order.",
    desc_sw="Ndani ya misitu ya pwani ya Kenya, mti wa zamani wa Mbuyu unaanza kunong'ona siri zilizosahaulika kwa muda mrefu za nguvu za mababu, ukifunga hatima ya msichana mdogo kwenye agano la siri.",
    cover_en="voices_beneath_the_baobab_en.jpg",
    cover_sw="sauti_chini_ya_mbuyu_sw.jpg"
)

# 4. Book 2: Zuri: Queen of Fashion
b2 = process_book_dir(
    folder_path=os.path.join(BASE_NOVELS_DIR, "Zuri Malkia wa Mitindo"),
    book_id="zuri-queen-of-fashion",
    title_en="Zuri: Queen of Fashion",
    title_sw="Zuri: Malkia wa Mitindo",
    author="Amina Hassan",
    category="Romance",
    tags=["Fashion", "Nairobi", "Romance", "High Society"],
    desc_en="A young woman from Kibera rises through Nairobi's high fashion world, facing rivalry, betrayal, and unexpected love.",
    desc_sw="Msichana mdogo kutoka Kibera anainuka kupitia ulimwengu wa mitindo wa Nairobi, akikutana na ushindani, usaliti na pendo lisilotarajiwa.",
    cover_en="zuri_queen_of_fashion_en.jpg",
    cover_sw="zuri_malkia_wa_mitindo_sw.jpg"
)

# 5. Book 3: Ninety Minutes of Darkness
b3 = process_book_dir(
    folder_path=os.path.join(BASE_NOVELS_DIR, "Dakika_Tisini_za_Giza_complete_project"),
    book_id="ninety-minutes-of-darkness",
    title_en="Ninety Minutes of Darkness",
    title_sw="Dakika Tisini za Giza",
    author="Juma Kilo",
    category="Thriller",
    tags=["Mombasa", "Blackout", "Heist", "Suspense"],
    desc_en="When a total blackout hits Mombasa, a team of specialized operatives must pull off an impossible heist in ninety minutes.",
    desc_sw="Wakati giza totoro likigubika Mombasa, kikundi cha wataalamu lazima kitekeleze wizi usioowekana ndani ya dakika tisini.",
    cover_en="ninety_minutes_of_darkness_en.jpg",
    cover_sw="dakika_tisini_za_giza_sw.jpg"
)

# 6. Book 4: The Last Title Deed
b4 = process_book_dir(
    folder_path=os.path.join(BASE_NOVELS_DIR, "Hati_ya_Mwisho_complete_project"),
    book_id="the-last-title-deed",
    title_en="The Last Title Deed",
    title_sw="Hati ya Mwisho",
    author="Kiprono Cheruiyot",
    category="Contemporary",
    tags=["Rift Valley", "Inheritance", "Land Conflict", "Family Drama"],
    desc_en="A fierce battle for ancestral land in the Rift Valley uncovers decades of family secrets and political corruption.",
    desc_sw="Vita vikali vya kuwania shamba la mababu katika Bonde la Ufa vinafichua siri za kifamilia na ufisadi wa kisiasa wa miongo mingi.",
    cover_en="the_last_title_deed_en.jpg",
    cover_sw="hati_ya_mwisho_sw.jpg"
)

ALL_6_BOOKS = [b for b in [b5, b6, b1, b2, b3, b4] if b is not None]

BOOKS_DATA_FILE = "/Users/yvoche/AI开发/071_非洲阅读/src/data/booksData.ts"

HEADER = """import { Book } from '../types';

export const CATEGORIES = [
  'All',
  'Romance',
  'Thriller',
  'Sci-Fi',
  'Historical',
  'Fantasy',
  'Contemporary',
  'Urban Fantasy'
];

export const QUICK_NAVIGATION_ITEMS = [
  {
    title: 'Top Rated',
    titleSwahili: 'Bora Zaidi',
    iconUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=100',
    tabName: 'rankings'
  },
  {
    title: 'Categories',
    titleSwahili: 'Vipengele',
    iconUrl: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&q=80&w=100',
    tabName: 'categories'
  },
  {
    title: 'Bilingual',
    titleSwahili: 'Lugha Mbili',
    iconUrl: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&q=80&w=100',
    tabName: 'bilingual'
  }
];

export const BOOKS_DATA: Book[] = """

final_ts = HEADER + json.dumps(ALL_6_BOOKS, ensure_ascii=False, indent=2) + ";\n"

with open(BOOKS_DATA_FILE, "w", encoding="utf-8") as f:
    f.write(final_ts)

print(f"🎉 100% PERFECT: Successfully built full {len(ALL_6_BOOKS)} books into booksData.ts with QUICK_NAVIGATION_ITEMS!")
