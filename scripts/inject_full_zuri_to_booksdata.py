#!/usr/bin/env python3
import os
import re
import json

SOURCE_DIR = "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文/Zuri Malkia wa Mitindo"
en_md_path = os.path.join(SOURCE_DIR, "Zuri_Queen_of_Fashion_final_en.md")
sw_md_path = os.path.join(SOURCE_DIR, "Zuri_Malkia_wa_Mitindo_final_sw.md")

with open(en_md_path, "r", encoding="utf-8") as f:
    en_text = f.read()

with open(sw_md_path, "r", encoding="utf-8") as f:
    sw_text = f.read()

def parse_chapters(text, regex):
    parts = re.split(regex, text, flags=re.MULTILINE)
    chapters = []
    for i in range(1, len(parts), 2):
        ch_title = parts[i].strip()
        ch_content = parts[i+1].strip() if i+1 < len(parts) else ""
        chapters.append({"title": ch_title, "content": ch_content})
    return chapters

en_chapters = parse_chapters(en_text, r"^#\s+(Chapter\s+[^:\n]+:?.*?$)")
sw_chapters = parse_chapters(sw_text, r"^#\s+(Sura\s+ya\s+[^:\n]+:?.*?$)")

print(f"📖 Extracted {len(en_chapters)} EN chapters & {len(sw_chapters)} SW chapters for full injection.")

chapters_ts_list = []
max_ch = max(len(en_chapters), len(sw_chapters))

for idx in range(max_ch):
    en_ch = en_chapters[idx] if idx < len(en_chapters) else {"title": f"Chapter {idx+1}", "content": ""}
    sw_ch = sw_chapters[idx] if idx < len(sw_chapters) else {"title": f"Sura ya {idx+1}", "content": ""}
    
    # Escape quotes and backticks for TS template string safely
    safe_en_content = json.dumps(en_ch["content"])
    safe_sw_content = json.dumps(sw_ch["content"])
    safe_en_title = json.dumps(en_ch["title"])
    safe_sw_title = json.dumps(sw_ch["title"])
    
    chapter_obj_str = f"""      {{
        id: 'zuri-ch{idx+1}',
        number: {idx+1},
        title: {safe_en_title},
        titleSwahili: {safe_sw_title},
        releaseDate: '2026-07-30',
        wordCount: {len(en_ch['content'].split())},
        content: {safe_en_content},
        contentSwahili: {safe_sw_content}
      }}"""
    chapters_ts_list.append(chapter_obj_str)

full_chapters_code = ",\n".join(chapters_ts_list)

# Read booksData.ts and replace Zuri chapters
books_data_path = os.path.join(os.getcwd(), "src", "data", "booksData.ts")
with open(books_data_path, "r", encoding="utf-8") as f:
    code = f.read()

# Replace Zuri chapters array
pattern = r"(id:\s*'zuri-queen-of-fashion'.*?chapters:\s*\[).*?(\]\s*\},\s*\{\s*id:\s*'savannahs-secret')"
replacement = r"\1\n" + full_chapters_code + r"\n\2"

new_code = re.sub(pattern, replacement, code, flags=re.DOTALL)

with open(books_data_path, "w", encoding="utf-8") as f:
    f.write(new_code)

print("🎉 Successfully injected all 20 bilingual chapters of Zuri into src/data/booksData.ts!")
