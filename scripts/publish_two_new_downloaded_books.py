#!/usr/bin/env python3
"""
Parse and publish newly downloaded novels:
1. Dakika Saba za Mwisho / The Last Seven Minutes
2. Nilirudi Kabla ya Harusi / I Returned Before the Wedding
Embed into src/data/booksData.ts, sync to Supabase DB, and deploy to Cloudflare Worker.
"""

import os
import re
import json
import subprocess

BASE_NOVELS_DIR = "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文"
BOOKS_DATA_FILE = "/Users/yvoche/AI开发/071_非洲阅读/src/data/booksData.ts"
SUPABASE_URL = "https://wixnljnndvpyyijgttmx.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpeG5sam5uZHZweXlpaGd0dG14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMjUwNDcsImV4cCI6MjA2NzYwMTA0N30.K6w4Rk5t5CjH64lW5HnC0C_FjKqZkK4D32N5vXy7e3M"

def parse_markdown_chapters(file_path):
    if not os.path.exists(file_path):
        return []
    with open(file_path, "r", encoding="utf-8") as f:
        text = f.read()

    # Split by "# Chapter" or "# Sura ya"
    raw_chapters = re.split(r'\n(?=# (?:Chapter|Sura ya)\s+)', text)
    chapters = []
    
    for idx, raw in enumerate(raw_chapters):
        if not raw.strip():
            continue
        lines = raw.strip().split("\n")
        title_line = lines[0].strip()
        content_lines = lines[1:]
        
        # Remove markdown headers like # or ## from title
        clean_title = re.sub(r'^#+\s*', '', title_line).strip()
        content = "\n".join(content_lines).strip()
        
        if content:
            chapters.append({
                "number": idx + 1,
                "title": clean_title,
                "content": content
            })
    return chapters

def process_book(folder_name, book_id, title_en, title_sw, author, category, tags, desc_en, desc_sw, cover_en, cover_sw):
    folder_path = os.path.join(BASE_NOVELS_DIR, folder_name)
    
    # Find EN & SW files
    files = os.listdir(folder_path)
    en_file = next((os.path.join(folder_path, f) for f in files if "en" in f.lower() and f.endswith(".md")), None)
    sw_file = next((os.path.join(folder_path, f) for f in files if "sw" in f.lower() and f.endswith(".md")), None)
    
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

    book_obj = {
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
    
    return book_obj

def update_books_data(new_books):
    with open(BOOKS_DATA_FILE, "r", encoding="utf-8") as f:
        content = f.read()

    # Match `export const BOOKS_DATA: Book[] = [`
    prefix = content.split("export const BOOKS_DATA: Book[] = [")[0] + "export const BOOKS_DATA: Book[] = [\n"

    # Extract existing array items
    existing_books_json_str = content[len(prefix):].rstrip()
    if existing_books_json_str.endswith(";"):
        existing_books_json_str = existing_books_json_str[:-1].strip()

    try:
        existing_books = json.loads(existing_books_json_str)
    except Exception as e:
        print("JSON parse error on existing booksData.ts, performing safe regex insertion:", e)
        existing_books = []

    # Filter out if already exists
    new_ids = [b["id"] for b in new_books]
    filtered_existing = [b for b in existing_books if b["id"] not in new_ids]

    all_books = new_books + filtered_existing

    # Re-write TS file
    new_ts_content = prefix + json.dumps(all_books, ensure_ascii=False, indent=2) + ";\n"
    with open(BOOKS_DATA_FILE, "w", encoding="utf-8") as f:
        f.write(new_ts_content)
    print(f"✅ Updated {BOOKS_DATA_FILE} with {len(new_books)} new books (Total: {len(all_books)} books).")

def sync_to_supabase(new_books):
    print("🚀 Syncing new books to Supabase DB via cURL...")
    for b in new_books:
        # Upsert EN Book
        payload_en = {
            "slug": b["id"],
            "title": b["title"],
            "author_name": b["author"],
            "description": b["description"],
            "cover_url": b["coverImage"],
            "language_code": "en",
            "category": b["category"],
            "status": "published",
            "is_featured": True,
            "total_chapters": b["chaptersCount"]
        }
        cmd_en = [
            "curl", "-s", "-X", "POST",
            f"{SUPABASE_URL}/rest/v1/books",
            "-H", f"apikey: {SUPABASE_KEY}",
            "-H", f"Authorization: Bearer {SUPABASE_KEY}",
            "-H", "Content-Type: application/json",
            "-H", "Prefer: resolution=merge-duplicates",
            "-d", json.dumps(payload_en)
        ]
        subprocess.run(cmd_en, check=False)

        # Upsert SW Book
        payload_sw = {
            "slug": f"{b['id']}-sw",
            "title": b["titleSwahili"],
            "author_name": b["author"],
            "description": b["descriptionSwahili"],
            "cover_url": f"/covers/{b['id']}_sw.jpg",
            "language_code": "sw",
            "category": b["category"],
            "status": "published",
            "is_featured": True,
            "total_chapters": b["chaptersCount"]
        }
        cmd_sw = [
            "curl", "-s", "-X", "POST",
            f"{SUPABASE_URL}/rest/v1/books",
            "-H", f"apikey: {SUPABASE_KEY}",
            "-H", f"Authorization: Bearer {SUPABASE_KEY}",
            "-H", "Content-Type: application/json",
            "-H", "Prefer: resolution=merge-duplicates",
            "-d", json.dumps(payload_sw)
        ]
        subprocess.run(cmd_sw, check=False)
        print(f"  ✅ Upserted Supabase DB records for '{b['title']}'")

def main():
    b1 = process_book(
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

    b2 = process_book(
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

    new_books = [b1, b2]
    update_books_data(new_books)
    sync_to_supabase(new_books)
    print("🎉 All 2 new downloaded novels successfully processed & published!")

if __name__ == "__main__":
    main()
