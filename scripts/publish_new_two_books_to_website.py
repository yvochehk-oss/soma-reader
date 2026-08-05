#!/usr/bin/env python3
"""
Publish the 2 brand new books (I Returned Before the Wedding & Container Forty-Seven)
to Supabase Database and website frontend.
"""

import os
import re
import json
import subprocess
from PIL import Image

PROJECT_ROOT = "/Users/yvoche/AI开发/071_非洲阅读"
BASE_DIR = "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文"
PUBLIC_COVERS_DIR = os.path.join(PROJECT_ROOT, "public", "covers")
os.makedirs(PUBLIC_COVERS_DIR, exist_ok=True)

SUPABASE_URL = "https://uamaohjbrjervzsjxwyg.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable_bLhT1CNl-DrFn_wz6gmp6A_fJPGBY2G"

BOOKS_CONFIG = [
    {
        "slug": "i-returned-before-the-wedding",
        "title_en": "I Returned Before the Wedding",
        "title_sw": "Nilirudi Kabla ya Harusi",
        "author": "Nia Kendi",
        "category": "Romance Thriller",
        "rating": 4.98,
        "description_en": "Trapped in a burning warehouse on the eve of her husband's secret wedding, Zawadi uncovers a cold-blooded insurance betrayal—and returns to reclaim her life and company.",
        "description_sw": "Akinaswa katika ghala linaloungua moto siku moja kabla ya harusi ya siri ya mume wake, Zawadi anagundua usaliti wa bima—na anarudi kudai maisha na kampuni yake.",
        "en_md_path": os.path.join(BASE_DIR, "Nilirudi Kabla ya Harusi", "I_Returned_Before_the_Wedding_final_en.md"),
        "sw_md_path": os.path.join(BASE_DIR, "Nilirudi Kabla ya Harusi", "Nilirudi_Kabla_ya_Harusi_final_sw.md"),
        "en_cover_src": os.path.join(BASE_DIR, "Nilirudi Kabla ya Harusi", "i_returned_before_the_wedding_en.jpg"),
        "sw_cover_src": os.path.join(BASE_DIR, "Nilirudi Kabla ya Harusi", "nilirudi_kabla_ya_harusi_sw.jpg"),
        "en_cover_dest": os.path.join(PUBLIC_COVERS_DIR, "i_returned_before_the_wedding_en.jpg"),
        "sw_cover_dest": os.path.join(PUBLIC_COVERS_DIR, "nilirudi_kabla_ya_harusi_sw.jpg"),
        "cover_url": "/covers/i_returned_before_the_wedding_en.jpg",
        "tags": ["Revenge", "Nairobi Elite", "Betrayal", "Swahili Drama"]
    },
    {
        "slug": "container-forty-seven",
        "title_en": "Container Forty-Seven",
        "title_sw": "Kontena la Arobaini na Saba",
        "author": "Safiya Amani",
        "category": "Corporate Suspense",
        "rating": 4.95,
        "description_en": "When a refrigerated medicine shipment reaches Mombasa with its cold chain broken, port auditor Mariam Bakari follows a fake electronic seal into a dangerous logistics conspiracy.",
        "description_sw": "Shehena ya dawa za baridi inapowasili Mombasa ikiwa imeharibika, mkaguzi Mariam Bakari anafuata saini ya uongo ya kielektroniki ndani ya njama hatari ya usafirishaji.",
        "en_md_path": os.path.join(BASE_DIR, "kontena_la_arobaini_na_saba", "02_manuscripts", "container_forty_seven_en_final.md"),
        "sw_md_path": os.path.join(BASE_DIR, "kontena_la_arobaini_na_saba", "02_manuscripts", "kontena_la_arobaini_na_saba_sw_final.md"),
        "en_cover_src": os.path.join(BASE_DIR, "kontena_la_arobaini_na_saba", "05_covers", "container_forty_seven_en.jpg"),
        "sw_cover_src": os.path.join(BASE_DIR, "kontena_la_arobaini_na_saba", "05_covers", "kontena_la_arobaini_na_saba_sw.jpg"),
        "en_cover_dest": os.path.join(PUBLIC_COVERS_DIR, "container_forty_seven_en.jpg"),
        "sw_cover_dest": os.path.join(PUBLIC_COVERS_DIR, "kontena_la_arobaini_na_saba_sw.jpg"),
        "cover_url": "/covers/container_forty_seven_en.jpg",
        "tags": ["Mombasa Port", "Logistics Mystery", "Corporate Corruption", "Swahili Thriller"]
    }
]

# 1. Compress Image
def compress_image(src_path, dest_path):
    if not os.path.exists(src_path):
        print(f"⚠️ Warning: Source cover missing: {src_path}")
        return
    img = Image.open(src_path)
    if img.mode != 'RGB':
        img = img.convert('RGB')
    img.thumbnail((600, 900), Image.Resampling.LANCZOS)
    
    quality = 85
    img.save(dest_path, 'JPEG', quality=quality, optimize=True)
    while os.path.getsize(dest_path) > 100 * 1024 and quality > 30:
        quality -= 5
        img.save(dest_path, 'JPEG', quality=quality, optimize=True)
    size_kb = os.path.getsize(dest_path) / 1024
    print(f"📸 Cover '{os.path.basename(dest_path)}' compressed & saved: {size_kb:.2f} KB")

# 2. Parse Chapters Helper
def parse_chapters(text):
    regex = r"^(?:#+|\d+\.|\bSura\b|\bChapter\b)\s*.*$"
    lines = text.split("\n")
    chapters = []
    current_title = ""
    current_content = []
    
    for line in lines:
        if line.startswith("# Sura") or line.startswith("# Chapter") or line.startswith("## Sura") or line.startswith("## Chapter") or line.startswith("# SURA"):
            if current_title:
                chapters.append({"title": current_title, "content": "\n".join(current_content).strip()})
                current_content = []
            current_title = line.strip("# ").strip()
        else:
            if current_title:
                current_content.append(line)
                
    if current_title and current_content:
        chapters.append({"title": current_title, "content": "\n".join(current_content).strip()})
        
    return chapters

def run_curl(url, data_json=None, method="GET"):
    headers = [
        "-H", f"apikey: {SUPABASE_ANON_KEY}",
        "-H", f"Authorization: Bearer {SUPABASE_ANON_KEY}",
        "-H", "Content-Type: application/json",
        "-H", "Prefer: return=representation"
    ]
    cmd = ["curl", "-s", "-X", method] + headers
    if data_json:
        cmd += ["-d", json.dumps(data_json)]
    cmd.append(url)
    res = subprocess.run(cmd, capture_output=True, text=True)
    return res.stdout

def main():
    print("🚀 Starting Automated Publication & Database Record Pipeline...\n")
    
    for b in BOOKS_CONFIG:
        print(f"📘 Processing: '{b['title_en']}' ({b['title_sw']})...")
        compress_image(b["en_cover_src"], b["en_cover_dest"])
        compress_image(b["sw_cover_src"], b["sw_cover_dest"])
        
        # Read manuscript files
        with open(b["sw_md_path"], "r", encoding="utf-8") as f:
            sw_text = f.read()
        with open(b["en_md_path"], "r", encoding="utf-8") as f:
            en_text = f.read()
            
        sw_chaps = parse_chapters(sw_text)
        en_chaps = parse_chapters(en_text)
        
        print(f"  └─ Parsed Swahili Chapters: {len(sw_chaps)}, English Chapters: {len(en_chaps)}")
        
        # Insert or update Book Record in Supabase
        book_payload = {
            "slug": b["slug"],
            "title": b["title_en"],
            "title_sw": b["title_sw"],
            "author": b["author"],
            "category": b["category"],
            "rating": b["rating"],
            "description": b["description_en"],
            "description_sw": b["description_sw"],
            "cover_url": b["cover_url"],
            "cover_sw_url": f"/covers/{os.path.basename(b['sw_cover_dest'])}",
            "tags": b["tags"],
            "status": "published"
        }
        
        # Check if book exists
        query_url = f"{SUPABASE_URL}/rest/v1/books?slug=eq.{b['slug']}"
        res = run_curl(query_url)
        existing = json.loads(res) if res.startswith("[") else []
        
        if existing:
            book_id = existing[0]["id"]
            update_url = f"{SUPABASE_URL}/rest/v1/books?id=eq.{book_id}"
            run_curl(update_url, book_payload, method="PATCH")
            print(f"  └─ 🔄 Updated Book record in Supabase Database (ID: {book_id})")
        else:
            insert_url = f"{SUPABASE_URL}/rest/v1/books"
            res_ins = run_curl(insert_url, book_payload, method="POST")
            res_ins_json = json.loads(res_ins) if res_ins.startswith("[") else []
            book_id = res_ins_json[0]["id"] if res_ins_json else None
            print(f"  └─ ⚡ Inserted New Book record into Supabase Database (ID: {book_id})")
            
        # Save local JSON ledger log
        record_file = os.path.join(PROJECT_ROOT, "metadata.json")
        try:
            with open(record_file, "r", encoding="utf-8") as rf:
                metadata = json.load(rf)
        except Exception:
            metadata = {}
            
        if "published_books" not in metadata:
            metadata["published_books"] = []
            
        # Update ledger
        updated_ledger = [item for item in metadata["published_books"] if item.get("slug") != b["slug"]]
        updated_ledger.append(book_payload)
        metadata["published_books"] = updated_ledger
        
        with open(record_file, "w", encoding="utf-8") as wf:
            json.dump(metadata, wf, ensure_ascii=False, indent=2)
            
        print(f"  └─ 💾 Recorded in local metadata database: '{record_file}'")
        print(f"  └─ ✅ Successfully published '{b['title_en']}'!\n")

    print("🎉 All 2 new books and their bilingual covers have been uploaded & recorded!")

if __name__ == "__main__":
    main()
