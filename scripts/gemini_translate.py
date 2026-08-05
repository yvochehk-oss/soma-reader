#!/usr/bin/env python3
import os
import sys
import json
import argparse
import re
import time
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

# Relaxed Regex for structural markers. 
# Matches [[NT_SEG:0001]], allows trailing spaces and content on the same line.
SEGMENT_MARKER_RE = re.compile(r"\[\[NT_SEG:\s*(\d{4})\s*\]\]")

SYSTEM_PROMPT = """You are a highly skilled literary translator translating a classic English novel into beautiful, modern Kenyan Swahili (sw-KE).
Return only the Swahili translation. Preserve every fact, number, name, relationship, and event. Do not summarize, explain, or rewrite.

CRITICAL INSTRUCTION:
The input text contains structural markers like [[NT_SEG:0001]]. These markers define paragraph boundaries.
You MUST preserve every single marker EXACTLY as provided, in the exact same order.
Output the translation for each segment immediately following its corresponding marker."""

def count_words(text: str) -> int:
    return max(1, len(re.findall(r"\b[\w’'-]+\b|[^\s]", text, re.UNICODE)))

def chunk_text(text: str, target_words: int = 400) -> list[str]:
    """Splits text by \n\n and groups paragraphs into chunks of roughly target_words."""
    paragraphs = text.split("\n\n")
    chunks = []
    current_chunk = []
    current_words = 0
    
    for p in paragraphs:
        p = p.strip()
        if not p:
            continue
        words = count_words(p)
        if current_chunk and current_words + words > target_words:
            chunks.append("\n\n".join(current_chunk))
            current_chunk = []
            current_words = 0
        current_chunk.append(p)
        current_words += words
        
    if current_chunk:
        chunks.append("\n\n".join(current_chunk))
    return chunks

def mark_paragraphs(chunk_text: str) -> tuple[str, list[str]]:
    """Wrap each source paragraph in a translatable marker."""
    paragraphs = [part.strip() for part in chunk_text.split("\n\n") if part.strip()]
    marked = "\n\n".join(f"[[NT_SEG:{index:04d}]]\n{paragraph}" for index, paragraph in enumerate(paragraphs, start=1))
    return marked, [f"{index:04d}" for index in range(1, len(paragraphs) + 1)]

def unmark_paragraphs(translated: str, expected_markers: list[str]) -> tuple[str, bool]:
    """
    Robust unmarking function. Splits text based on the markers.
    Returns (cleaned text, is_valid).
    """
    matches = SEGMENT_MARKER_RE.findall(translated)
    
    # If the model missed or fabricated markers, we log a warning but try to salvage it.
    is_valid = (matches == expected_markers)
    
    # Split text. The split result will look like: 
    # [ "garbage before first marker", "0001", "text after first marker", "0002", "text after second", ...]
    parts = SEGMENT_MARKER_RE.split(translated)
    
    paragraphs = []
    # If a marker was found, `parts` will have len >= 3.
    # parts[1] is the first marker, parts[2] is the text after it.
    for i in range(1, len(parts), 2):
        marker_id = parts[i]
        content = parts[i+1].strip()
        paragraphs.append(content)
    
    if not paragraphs:
        # Fallback if regex failed completely
        return translated.strip(), False
        
    return "\n\n".join(paragraphs), is_valid

class GeminiClient:
    def __init__(self, api_key: str, model: str = "gemini-2.5-flash"):
        self.api_key = api_key
        self.model = model
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"
        
    def generate(self, prompt: str, system_instruction: str, max_tokens: int = 1500, temperature: float = 0.2) -> str:
        url = f"{self.base_url}/models/{self.model}:generateContent?key={self.api_key}"
        
        payload = {
            "system_instruction": {
                "parts": [{"text": system_instruction}]
            },
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
                "responseMimeType": "text/plain",
            }
        }
        
        req = Request(url, data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"})
        
        max_retries = 5
        backoff = 2
        for attempt in range(max_retries):
            try:
                with urlopen(req, timeout=120) as response:
                    data = json.loads(response.read().decode("utf-8"))
                    text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                    return text
            except HTTPError as exc:
                if exc.code == 429:
                    print(f"⚠️ Rate limited (429). Waiting {backoff}s before retry...")
                    time.sleep(backoff)
                    backoff *= 2
                    continue
                else:
                    raise
            except (URLError, TimeoutError) as exc:
                print(f"⚠️ Network error ({exc}). Waiting {backoff}s before retry...")
                time.sleep(backoff)
                backoff *= 2
                continue
                
        raise RuntimeError("Failed to generate translation after multiple retries.")

def get_progress_file(input_file: Path, progress_dir: Path) -> Path:
    return progress_dir / f"{input_file.stem}_progress.json"

def load_progress(progress_file: Path) -> dict:
    if progress_file.exists():
        with open(progress_file, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"chunks": []}

def save_progress(progress_file: Path, data: dict):
    with open(progress_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def process_file(client: GeminiClient, input_file: Path, output_file: Path, progress_dir: Path, args):
    print(f"\n🚀 Processing: {input_file.name}")
    
    text = input_file.read_text(encoding="utf-8")
    chunks = chunk_text(text, target_words=args.target_words)
    
    progress_file = get_progress_file(input_file, progress_dir)
    progress_data = load_progress(progress_file)
    translated_chunks = progress_data.get("chunks", [])
    
    if len(translated_chunks) >= len(chunks):
        print(f"✅ Already fully translated: {input_file.name}")
        if not output_file.exists():
            output_file.write_text("\n\n".join(translated_chunks), encoding="utf-8")
        return True
        
    print(f"📊 Progress: {len(translated_chunks)}/{len(chunks)} chunks translated.")
    
    start_index = len(translated_chunks)
    
    try:
        for i in range(start_index, len(chunks)):
            target_text = chunks[i]
            
            # Context injection
            context_block = ""
            if i > 0:
                context_block = f"--- PREVIOUS CONTEXT (DO NOT TRANSLATE) ---\n{chunks[i-1][-800:]}\n\n"
                
            # Marked Paragraphs Protocol
            marked_source, expected_markers = mark_paragraphs(target_text)
            
            prompt = f"{context_block}--- TARGET TEXT TO TRANSLATE ---\n{marked_source}"
            
            print(f"⏳ Translating chunk {i+1}/{len(chunks)} ({count_words(target_text)} words)...")
            
            start_time = time.time()
            raw_result = client.generate(
                prompt=prompt,
                system_instruction=SYSTEM_PROMPT,
                max_tokens=args.max_tokens,
                temperature=args.temp
            )
            elapsed = time.time() - start_time
            
            cleaned_swahili, is_valid = unmark_paragraphs(raw_result, expected_markers)
            
            if not is_valid:
                print(f"   ⚠️ Warning: Chunk {i+1} structural marker validation failed. Fallback extraction used.")
                
            print(f"   ✓ Done in {elapsed:.1f}s.")
            
            translated_chunks.append(cleaned_swahili)
            progress_data["chunks"] = translated_chunks
            save_progress(progress_file, progress_data)
            
            # Simple rate limit protection
            time.sleep(2)
            
    except KeyboardInterrupt:
        print(f"\n⚠️ Interrupted by user. Progress saved for {input_file.name}.")
        return False
    except Exception as e:
        print(f"\n❌ Error translating {input_file.name}: {e}")
        return False
        
    print(f"💾 Saving final translation to {output_file}")
    output_file.write_text("\n\n".join(translated_chunks), encoding="utf-8")
    return True

def main():
    parser = argparse.ArgumentParser(description="Batch translate formatted novels to Swahili using Gemini API.")
    parser.add_argument("input_dir", type=Path, help="Directory containing formatted English .txt files")
    parser.add_argument("output_dir", type=Path, help="Directory to save translated Swahili files")
    parser.add_argument("--model", type=str, default="gemini-2.5-flash", help="Gemini model ID")
    parser.add_argument("--progress-dir", type=Path, help="Directory to save progress state")
    parser.add_argument("--target-words", type=int, default=400, help="Target words per chunk")
    parser.add_argument("--max-tokens", type=int, default=1600, help="Max tokens per chunk generation")
    parser.add_argument("--temp", type=float, default=0.2, help="Temperature (0.2 recommended for literature)")
    parser.add_argument("--test", type=int, default=0, help="Number of files to process for a dry-run test (0 for all)")
    
    args = parser.parse_args()
    
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("❌ GEMINI_API_KEY environment variable is missing.")
        sys.exit(1)
        
    if not args.input_dir.is_dir():
        print(f"❌ Input directory not found: {args.input_dir}")
        sys.exit(1)
        
    args.output_dir.mkdir(parents=True, exist_ok=True)
    progress_dir = args.progress_dir if args.progress_dir else args.output_dir / ".progress"
    progress_dir.mkdir(parents=True, exist_ok=True)
    
    files_to_process = sorted(list(args.input_dir.glob("*.txt")))
    if not files_to_process:
        print(f"⚠️ No .txt files found in {args.input_dir}")
        sys.exit(0)
        
    if args.test > 0:
        files_to_process = files_to_process[:args.test]
        
    print(f"📚 Found {len(files_to_process)} books to process with {args.model}.")
    
    client = GeminiClient(api_key=api_key, model=args.model)
    
    success_count = 0
    for txt_file in files_to_process:
        out_file = args.output_dir / f"{txt_file.stem}_swahili.txt"
        if process_file(client, txt_file, out_file, progress_dir, args):
            success_count += 1
        else:
            print("🛑 Stopping batch process due to interruption or error.")
            break
            
    print(f"\n🎉 Batch processing finished. {success_count}/{len(files_to_process)} completed fully.")

if __name__ == "__main__":
    main()
