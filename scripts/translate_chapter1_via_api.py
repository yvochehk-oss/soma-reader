import os
import json
import urllib.parse
import urllib.request

API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash").strip()

ENGLISH_FILE = "/Users/yvoche/AI开发/071_非洲阅读/0.0书籍正文/The Billionaire's Rejected Bride: Rise of the Sun Queen/English/full_story.txt"
OUTPUT_FILE = "/Users/yvoche/AI开发/071_非洲阅读/0.0书籍正文/The Billionaire's Rejected Bride: Rise of the Sun Queen/Kiswahili/Chapter_1_Bilingual_Alignment_Via_Gemini_API.md"


def main():
    if not API_KEY:
        raise RuntimeError("GEMINI_API_KEY is required. Set it in the environment before running this script.")

    api_url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{urllib.parse.quote(MODEL, safe='')}:generateContent"
    )
    print("🚀 Reading Chapter 1...", flush=True)
    with open(ENGLISH_FILE, "r", encoding="utf-8") as source_file:
        lines = source_file.readlines()

    ch1_text = "".join(lines[2:53])
    prompt = f"""You are a professional literary translator specializing in translating English novels to Swahili (Kiswahili).
Please translate the following chapter into fluent, authentic, high-quality Kiswahili.
Maintain the exact paragraph structure. For each paragraph, output the English paragraph first followed immediately by its Swahili translation in this format:

### [EN] Paragraph N
<English paragraph>

### [SW] Fungu la N
<Swahili translation>

---

Here is the Chapter text:
{ch1_text}"""

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2},
    }

    print(f"📡 Calling Gemini API ({MODEL})...", flush=True)
    request = urllib.request.Request(
        api_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": API_KEY},
    )

    with urllib.request.urlopen(request) as response:
        result = json.loads(response.read().decode("utf-8"))
        result_text = result["candidates"][0]["content"]["parts"][0]["text"]

    header_text = (
        "# Chapter 1: The Blood Contract (Bilingual Alignment via Gemini API)\n"
        f"> **Model**: `{MODEL}` (Google AI Studio Official API)\n\n---\n\n"
    )
    with open(OUTPUT_FILE, "w", encoding="utf-8") as output_file:
        output_file.write(header_text + result_text)

    print(f"🎉 Successfully created bilingual file via Gemini API:\n{OUTPUT_FILE}", flush=True)


if __name__ == "__main__":
    main()
