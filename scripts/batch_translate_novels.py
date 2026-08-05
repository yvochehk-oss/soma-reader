#!/usr/bin/env python3
import os
import sys
import json
import argparse
from pathlib import Path
from translate import TranslationEngine

# System prompt for context-aware chunking
SYSTEM_PROMPT = """You are a highly skilled literary translator specializing in translating classic English literature into beautiful, idiomatic Swahili.
Your task is to translate the provided text chunk into Swahili.

CRITICAL INSTRUCTIONS:
1. Maintain the exact same paragraph structure. If the input has 5 paragraphs separated by blank lines, your output MUST have exactly 5 paragraphs separated by blank lines.
2. The user will provide the PREVIOUS paragraph for context only (to help with pronouns, names, and tone). DO NOT translate the context paragraph. ONLY translate the target text.
3. Output ONLY the translated Swahili text. Do not include any notes, markdown formatting, or explanations."""

def count_words(text: str) -> int:
    return len(text.split())

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

def process_file(engine: TranslationEngine, input_file: Path, output_file: Path, progress_dir: Path, args):
    print(f"\n🚀 Processing: {input_file.name}")
    
    text = input_file.read_text(encoding="utf-8")
    chunks = chunk_text(text, target_words=400)
    
    progress_file = get_progress_file(input_file, progress_dir)
    progress_data = load_progress(progress_file)
    translated_chunks = progress_data.get("chunks", [])
    
    if len(translated_chunks) >= len(chunks):
        print(f"✅ Already fully translated: {input_file.name}")
        # Ensure output file exists
        if not output_file.exists():
            output_file.write_text("\n\n".join(translated_chunks), encoding="utf-8")
        return True
        
    print(f"📊 Progress: {len(translated_chunks)}/{len(chunks)} chunks translated.")
    
    start_index = len(translated_chunks)
    
    try:
        for i in range(start_index, len(chunks)):
            target_text = chunks[i]
            context_text = chunks[i-1] if i > 0 else "This is the very beginning of the book."
            
            prompt = f"--- PREVIOUS CONTEXT (DO NOT TRANSLATE) ---\n{context_text}\n\n--- TARGET TEXT TO TRANSLATE ---\n{target_text}"
            
            print(f"⏳ Translating chunk {i+1}/{len(chunks)} ({count_words(target_text)} words)...")
            
            result = engine.translate_text(
                prompt,
                src_lang="en",
                tgt_lang="sw",
                max_tokens=args.max_tokens,
                temp=args.temp,
                top_p=args.top_p,
                system_prompt=SYSTEM_PROMPT
            )
            
            translated_chunks.append(result)
            progress_data["chunks"] = translated_chunks
            save_progress(progress_file, progress_data)
            
    except KeyboardInterrupt:
        print(f"\n⚠️ Interrupted by user. Progress saved for {input_file.name}.")
        return False
    except Exception as e:
        print(f"\n❌ Error translating {input_file.name}: {e}")
        return False
        
    # Write final output
    print(f"💾 Saving final translation to {output_file}")
    output_file.write_text("\n\n".join(translated_chunks), encoding="utf-8")
    return True

def main():
    parser = argparse.ArgumentParser(description="Batch translate formatted novels to Swahili.")
    parser.add_argument("input_dir", type=Path, help="Directory containing formatted English .txt files")
    parser.add_argument("output_dir", type=Path, help="Directory to save translated Swahili files")
    parser.add_argument("--progress-dir", type=Path, help="Directory to save progress state (defaults to output_dir/.progress)")
    parser.add_argument("--max-tokens", type=int, default=1500, help="Max tokens per chunk generation")
    parser.add_argument("--temp", type=float, default=0.1, help="Temperature (0.1 recommended for accurate but fluid translation)")
    parser.add_argument("--top-p", type=float, default=0.9, help="Top-p sampling")
    
    args = parser.parse_args()
    
    if not args.input_dir.is_dir():
        print(f"❌ Input directory not found: {args.input_dir}")
        sys.exit(1)
        
    args.output_dir.mkdir(parents=True, exist_ok=True)
    
    progress_dir = args.progress_dir if args.progress_dir else args.output_dir / ".progress"
    progress_dir.mkdir(parents=True, exist_ok=True)
    
    files_to_process = list(args.input_dir.glob("*.txt"))
    if not files_to_process:
        print(f"⚠️ No .txt files found in {args.input_dir}")
        sys.exit(0)
        
    print(f"📚 Found {len(files_to_process)} books to process.")
    
    # Initialize engine once
    engine = TranslationEngine()
    
    success_count = 0
    for txt_file in files_to_process:
        out_file = args.output_dir / f"{txt_file.stem}_swahili.txt"
        
        # Process file
        if process_file(engine, txt_file, out_file, progress_dir, args):
            success_count += 1
        else:
            print("🛑 Stopping batch process due to interruption or error.")
            break
            
    print(f"\n🎉 Batch processing finished. {success_count}/{len(files_to_process)} completed fully.")

if __name__ == "__main__":
    main()
