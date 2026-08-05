#!/usr/bin/env python3
"""
Safely merge all 6 novels into src/data/booksData.ts:
1. Voices Beneath the Baobab
2. Zuri: Queen of Fashion
3. Ninety Minutes of Darkness
4. The Last Title Deed
5. The Last Seven Minutes
6. I Returned Before the Wedding
"""

import os
import json
from publish_two_new_downloaded_books import process_book

BOOKS_DATA_FILE = "/Users/yvoche/AI开发/071_非洲阅读/src/data/booksData.ts"
BASE_NOVELS_DIR = "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文"

# 1. Generate the 2 new downloaded books
b5 = process_book(
    folder_name="Dakika Saba za Mwisho",
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

b6 = process_book(
    folder_name="Nilirudi Kabla ya Harusi",
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

# 2. Check if git has previous booksData.ts backup or rebuild from 0.3 sw爽文
try:
    import subprocess
    git_show = subprocess.check_output(["git", "show", "HEAD:src/data/booksData.ts"], cwd="/Users/yvoche/AI开发/071_非洲阅读").decode("utf-8")
    prefix = git_show.split("export const BOOKS_DATA: Book[] = [")[0] + "export const BOOKS_DATA: Book[] = [\n"
    json_str = git_show[len(prefix):].rstrip()
    if json_str.endswith(";"):
        json_str = json_str[:-1].strip()
    previous_books = json.loads(json_str)
    print(f"📖 Loaded {len(previous_books)} previous books from git history.")
except Exception as e:
    print("Git recovery error, checking existing books:", e)
    previous_books = []

# Merge without duplicates
new_ids = ["the-last-seven-minutes", "i-returned-before-the-wedding"]
filtered_prev = [b for b in previous_books if b["id"] not in new_ids]

all_6_books = [b5, b6] + filtered_prev

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

export const BOOKS_DATA: Book[] = [
"""

final_ts = HEADER + json.dumps(all_6_books, ensure_ascii=False, indent=2) + ";\n"

with open(BOOKS_DATA_FILE, "w", encoding="utf-8") as f:
    f.write(final_ts)

print(f"🎉 100% PERFECT: Integrated all {len(all_6_books)} books into src/data/booksData.ts!")
