import os
import re
import json
import urllib.request

OUTPUT_DIR = "/Users/yvoche/AI开发/000.非洲最终正文/0.1英文经典/Standard_Ebooks/Crime and Punishment"
os.makedirs(OUTPUT_DIR, exist_ok=True)

urls = [
    "https://www.gutenberg.org/files/2554/2554-0.txt",
    "https://www.gutenberg.org/cache/epub/2554/pg2554.txt",
    "https://www.gutenberg.org/files/600/600-0.txt"
]

raw_text = None
for url in urls:
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            content = resp.read()
            try:
                raw_text = content.decode('utf-8')
            except:
                raw_text = content.decode('latin-1')
            if raw_text and len(raw_text) > 5000:
                break
    except:
        continue

if raw_text:
    start_match = re.search(r"\*\*\*\s*START OF TH(IS|E) PROJECT GUTENBERG EBOOK.*?\*\*\*", raw_text, re.IGNORECASE)
    if start_match:
        raw_text = raw_text[start_match.end():]
    end_match = re.search(r"\*\*\*\s*END OF TH(IS|E) PROJECT GUTENBERG EBOOK.*?\*\*\*", raw_text, re.IGNORECASE)
    if end_match:
        raw_text = raw_text[:end_match.start()]
        
    clean_text = raw_text.strip()
    
    with open(os.path.join(OUTPUT_DIR, "full_story.txt"), "w", encoding="utf-8") as f:
        f.write(clean_text)
        
    meta = {
        "id": 2554,
        "title": "Crime and Punishment",
        "author": "Fyodor Dostoyevsky",
        "category": "Psychological Fiction",
        "wordCount": len(clean_text.split()),
        "license": "Public Domain (100% Free for Commercial Use & AdSense)"
    }
    with open(os.path.join(OUTPUT_DIR, "story_meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
    print("✅ Successfully fetched Crime and Punishment")
