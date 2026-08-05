#!/usr/bin/env python3
"""
Top Project Gutenberg Classic English Novels Downloader & Stripper v2.5.
扩展至 50 本顶级公有领域英文名著大作，具备自动防重扫描。
100% Public Domain - Free for Commercial Use & Google AdSense Monetization.
"""

import os
import re
import json
import urllib.request
import time

OUTPUT_DIR = "/Users/yvoche/AI开发/000.非洲最终正文/0.1英文经典/Standard_Ebooks"
os.makedirs(OUTPUT_DIR, exist_ok=True)

POPULAR_NOVELS = [
    # 前 20 本已存在
    {"id": 1342, "title": "Pride and Prejudice", "author": "Jane Austen", "category": "Romance"},
    {"id": 84, "title": "Frankenstein", "author": "Mary Wollstonecraft Shelley", "category": "Horror/Sci-Fi"},
    {"id": 11, "title": "Alice's Adventures in Wonderland", "author": "Lewis Carroll", "category": "Fantasy"},
    {"id": 2701, "title": "Moby Dick; Or, The Whale", "author": "Herman Melville", "category": "Adventure"},
    {"id": 1661, "title": "The Adventures of Sherlock Holmes", "author": "Arthur Conan Doyle", "category": "Mystery"},
    {"id": 98, "title": "A Tale of Two Cities", "author": "Charles Dickens", "category": "Historical Fiction"},
    {"id": 120, "title": "Treasure Island", "author": "Robert Louis Stevenson", "category": "Adventure"},
    {"id": 345, "title": "Dracula", "author": "Bram Stoker", "category": "Horror"},
    {"id": 174, "title": "The Picture of Dorian Gray", "author": "Oscar Wilde", "category": "Classic Literature"},
    {"id": 4300, "title": "Ulysses", "author": "James Joyce", "category": "Modernist Fiction"},
    {"id": 16, "title": "Peter Pan", "author": "J. M. Barrie", "category": "Fantasy/Children"},
    {"id": 1952, "title": "The Yellow Wallpaper", "author": "Charlotte Perkins Gilman", "category": "Gothic"},
    {"id": 76, "title": "Adventures of Huckleberry Finn", "author": "Mark Twain", "category": "Adventure"},
    {"id": 1260, "title": "Jane Eyre: An Autobiography", "author": "Charlotte Brontë", "category": "Romance/Gothic"},
    {"id": 5200, "title": "Metamorphosis", "author": "Franz Kafka", "category": "Philosophical"},
    {"id": 2591, "title": "Grimms' Fairy Tales", "author": "Brothers Grimm", "category": "Folk Tales"},
    {"id": 1400, "title": "Great Expectations", "author": "Charles Dickens", "category": "Classics"},
    {"id": 1184, "title": "The Count of Monte Cristo", "author": "Alexandre Dumas", "category": "Adventure/Revenge"},
    {"id": 205, "title": "Walden, and On The Duty Of Civil Disobedience", "author": "Henry David Thoreau", "category": "Philosophy"},
    {"id": 2554, "title": "Crime and Punishment", "author": "Fyodor Dostoyevsky", "category": "Psychological Fiction"},
    
    # 新增 30 本经典大作
    {"id": 43, "title": "The Strange Case of Dr. Jekyll and Mr. Hyde", "author": "Robert Louis Stevenson", "category": "Gothic/Horror"},
    {"id": 829, "title": "Gulliver's Travels", "author": "Jonathan Swift", "category": "Satire/Adventure"},
    {"id": 74, "title": "The Adventures of Tom Sawyer", "author": "Mark Twain", "category": "Adventure"},
    {"id": 55, "title": "The Wonderful Wizard of Oz", "author": "L. Frank Baum", "category": "Children/Fantasy"},
    {"id": 2852, "title": "The Hound of the Baskervilles", "author": "Arthur Conan Doyle", "category": "Mystery"},
    {"id": 219, "title": "Heart of Darkness", "author": "Joseph Conrad", "category": "Fiction"},
    {"id": 145, "title": "Middlemarch", "author": "George Eliot", "category": "Classics"},
    {"id": 160, "title": "The Awakening, and Selected Short Stories", "author": "Kate Chopin", "category": "Classics"},
    {"id": 113, "title": "The Secret Garden", "author": "Frances Hodgson Burnett", "category": "Children/Classics"},
    {"id": 140, "title": "The Jungle Book", "author": "Rudyard Kipling", "category": "Adventure"},
    {"id": 2600, "title": "War and Peace", "author": "Leo Tolstoy", "category": "Historical Fiction"},
    {"id": 1399, "title": "Anna Karenina", "author": "Leo Tolstoy", "category": "Classics/Romance"},
    {"id": 36, "title": "The War of the Worlds", "author": "H. G. Wells", "category": "Sci-Fi"},
    {"id": 35, "title": "The Time Machine", "author": "H. G. Wells", "category": "Sci-Fi"},
    {"id": 1232, "title": "The Prince", "author": "Niccolò Machiavelli", "category": "Philosophy"},
    {"id": 28, "title": "Aesop's Fables", "author": "Aesop", "category": "Fables"},
    {"id": 16389, "title": "The Enchanted April", "author": "Elizabeth Von Arnim", "category": "Romance"},
    {"id": 730, "title": "Oliver Twist", "author": "Charles Dickens", "category": "Classics"},
    {"id": 100, "title": "The Complete Works of William Shakespeare", "author": "William Shakespeare", "category": "Drama"},
    {"id": 1023, "title": "Bleak House", "author": "Charles Dickens", "category": "Classics"},
    {"id": 1250, "title": "Anthem", "author": "Ayn Rand", "category": "Dystopian"},
    {"id": 1513, "title": "Romeo and Juliet", "author": "William Shakespeare", "category": "Drama"},
    {"id": 215, "title": "The Call of the Wild", "author": "Jack London", "category": "Adventure"},
    {"id": 996, "title": "Don Quixote", "author": "Miguel de Cervantes Saavedra", "category": "Classics"},
    {"id": 3207, "title": "Leviathan", "author": "Thomas Hobbes", "category": "Philosophy"},
    {"id": 41, "title": "The Legend of Sleepy Hollow", "author": "Washington Irving", "category": "Gothic"},
    {"id": 2160, "title": "The Expedition of Humphry Clinker", "author": "Tobias Smollett", "category": "Classics"},
    {"id": 45, "title": "Anne of Green Gables", "author": "L. M. Montgomery", "category": "Children/Classics"},
    {"id": 23, "title": "Narrative of the Life of Frederick Douglass", "author": "Frederick Douglass", "category": "Autobiography"},
    {"id": 161, "title": "Sense and Sensibility", "author": "Jane Austen", "category": "Romance"}
]

def scan_downloaded_books():
    """扫描本地目标目录，建立已下载书籍数据库（基于书名与ID去重）"""
    existing_meta = {}
    if not os.path.exists(OUTPUT_DIR):
        return existing_meta

    for folder in os.listdir(OUTPUT_DIR):
        folder_path = os.path.join(OUTPUT_DIR, folder)
        if os.path.isdir(folder_path):
            file_path = os.path.join(folder_path, "full_story.txt")
            meta_path = os.path.join(folder_path, "story_meta.json")
            
            if os.path.exists(file_path) and os.path.getsize(file_path) > 1000:
                book_id = None
                if os.path.exists(meta_path):
                    try:
                        with open(meta_path, "r", encoding="utf-8") as f:
                            meta_data = json.load(f)
                            book_id = meta_data.get("id")
                    except Exception:
                        pass
                existing_meta[folder.lower()] = True
                if book_id:
                    existing_meta[str(book_id)] = True
    return existing_meta

def strip_gutenberg_legal_headers(text: str) -> str:
    """自动切割剥离 Project Gutenberg 前后版权声明"""
    start_match = re.search(r"\*\*\*\s*START OF TH(IS|E) PROJECT GUTENBERG EBOOK.*?\*\*\*", text, re.IGNORECASE)
    if start_match:
        text = text[start_match.end():]
    else:
        alt_match = re.search(r"\*\*\*\s*START OF THIS PROJECT GUTENBERG.*?\*\*\*", text, re.IGNORECASE)
        if alt_match:
            text = text[alt_match.end():]

    end_match = re.search(r"\*\*\*\s*END OF TH(IS|E) PROJECT GUTENBERG EBOOK.*?\*\*\*", text, re.IGNORECASE)
    if end_match:
        text = text[:end_match.start()]
    else:
        alt_end = re.search(r"End of Project Gutenberg['’]s", text, re.IGNORECASE)
        if alt_end:
            text = text[:alt_end.start()]

    return text.strip()

def download_book(book_meta, existing_db):
    book_id = book_meta["id"]
    title = book_meta["title"]
    safe_title = re.sub(r'[\\/*?:"<>|]', "", title)
    book_folder = os.path.join(OUTPUT_DIR, safe_title)
    
    file_path = os.path.join(book_folder, "full_story.txt")

    if (str(book_id) in existing_db or safe_title.lower() in existing_db) and os.path.exists(file_path) and os.path.getsize(file_path) > 1000:
        print(f"⏩ [已存在·自动跳过] 《{title}》 (ID: {book_id})")
        return "skipped"

    os.makedirs(book_folder, exist_ok=True)
    meta_path = os.path.join(book_folder, "story_meta.json")

    urls = [
        f"https://www.gutenberg.org/cache/epub/{book_id}/pg{book_id}.txt",
        f"https://www.gutenberg.org/files/{book_id}/{book_id}-0.txt",
        f"https://www.gutenberg.org/files/{book_id}/{book_id}.txt"
    ]
    
    raw_text = None
    for url in urls:
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'})
            with urllib.request.urlopen(req, timeout=20) as response:
                content = response.read()
                try:
                    raw_text = content.decode('utf-8')
                except UnicodeDecodeError:
                    raw_text = content.decode('latin-1')
                if raw_text and len(raw_text) > 2000:
                    break
        except Exception:
            continue
            
    if not raw_text:
        print(f"❌ 下载失败: 《{title}》 (ID: {book_id})")
        return "failed"
        
    clean_text = strip_gutenberg_legal_headers(raw_text)
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(clean_text)
        
    meta = {
        "id": book_id,
        "title": title,
        "author": book_meta["author"],
        "category": book_meta["category"],
        "wordCount": len(clean_text.split()),
        "charCount": len(clean_text),
        "license": "Public Domain (100% Free for Commercial Use)",
        "downloadedAt": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
        
    print(f"✨ [全新下载完成] 《{title}》 ({meta['wordCount']} 词)")
    return "downloaded"

def main():
    print(f"🚀 开始批量扩展下载 Project Gutenberg 畅销英文名著 (共 50 本)...")
    print(f"📁 目标输出目录: {OUTPUT_DIR}\n")
    
    existing_db = scan_downloaded_books()
    print(f"🔍 扫描到已有本地完整图书: {len(set(existing_db.keys())) // 2} 本\n")

    stats = {"downloaded": 0, "skipped": 0, "failed": 0}

    for idx, item in enumerate(POPULAR_NOVELS, start=1):
        print(f"[{idx}/{len(POPULAR_NOVELS)}]", end=" ")
        result = download_book(item, existing_db)
        stats[result] += 1
        if result == "downloaded":
            time.sleep(0.3)
        
    print(f"\n🎉 任务处理完成！")
    print(f"📊 统计汇总: 新下载 {stats['downloaded']} 本 | 自动跳过重复 {stats['skipped']} 本 | 失败 {stats['failed']} 本")

if __name__ == "__main__":
    main()
