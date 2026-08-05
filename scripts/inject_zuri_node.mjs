import fs from 'fs';
import path from 'path';

const SOURCE_DIR = "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文/Zuri Malkia wa Mitindo";
const en_md_path = path.join(SOURCE_DIR, "Zuri_Queen_of_Fashion_final_en.md");
const sw_md_path = path.join(SOURCE_DIR, "Zuri_Malkia_wa_Mitindo_final_sw.md");

const en_text = fs.readFileSync(en_md_path, 'utf-8');
const sw_text = fs.readFileSync(sw_md_path, 'utf-8');

function parseChapters(text, regex) {
  const parts = text.split(regex);
  const chapters = [];
  for (let i = 1; i < parts.length; i += 2) {
    const title = parts[i].trim();
    const content = (parts[i + 1] || '').trim();
    chapters.push({ title, content });
  }
  return chapters;
}

const en_chapters = parseChapters(en_text, /^#\s+(Chapter\s+[^:\n]+:?.*?$)/m);
const sw_chapters = parseChapters(sw_text, /^#\s+(Sura\s+ya\s+[^:\n]+:?.*?$)/m);

console.log(`📖 Extracted ${en_chapters.length} EN chapters & ${sw_chapters.length} SW chapters.`);

const max_ch = Math.max(en_chapters.length, sw_chapters.length);
const chapterObjs = [];

for (let idx = 0; idx < max_ch; idx++) {
  const en_ch = en_chapters[idx] || { title: `Chapter ${idx + 1}`, content: "" };
  const sw_ch = sw_chapters[idx] || { title: `Sura ya ${idx + 1}`, content: "" };

  chapterObjs.push({
    id: `zuri-ch${idx + 1}`,
    number: idx + 1,
    title: en_ch.title,
    titleSwahili: sw_ch.title,
    releaseDate: '2026-07-30',
    wordCount: en_ch.content.split(/\s+/).length,
    content: en_ch.content,
    contentSwahili: sw_ch.content
  });
}

const booksDataPath = path.join(process.cwd(), "src", "data", "booksData.ts");
let code = fs.readFileSync(booksDataPath, 'utf-8');

// Construct full book object for Zuri
const zuriBookObj = {
  id: 'zuri-queen-of-fashion',
  title: "Zuri: Queen of Fashion",
  titleSwahili: 'Zuri: Malkia wa Mitindo',
  author: 'Asha Maridadi',
  category: 'Romance',
  rating: 9.9,
  heatMetric: '9.9',
  description:
    'Humiliated at a lavish Nairobi banquet after her fiancé breaks their engagement in public, Amina reveals her true identity as Zuri—the international queen of high fashion, immense wealth, and corporate power.',
  descriptionSwahili:
    'Akitukanwa katika karamu ya kifahari ya Nairobi baada ya mchumba wake kuvunja uchumba mbele ya watu, Amina anafichua utambulisho wake wa kweli kama Zuri—malkia wa kimataifa wa mitindo na nguvu za kibiashara.',
  coverImage: '/covers/zuri_queen_of_fashion_en.jpg',
  bannerImage: '/covers/zuri_queen_of_fashion_en.jpg',
  status: 'Hot',
  isEditorChoice: true,
  isBilingualAvailable: true,
  publishedYear: '2026',
  chaptersCount: chapterObjs.length,
  tags: ['Nairobi Fashion', 'Revenge', 'Billionaire', "Editor's Choice"],
  chapters: chapterObjs
};

// Replace Zuri in BOOKS_DATA
const startIdx = code.indexOf("id: 'zuri-queen-of-fashion'");
const endIdx = code.indexOf("id: 'savannahs-secret'");

if (startIdx !== -1 && endIdx !== -1) {
  const prefix = code.slice(0, code.lastIndexOf('{', startIdx));
  const suffix = code.slice(code.lastIndexOf('{', endIdx));
  
  const formattedZuriCode = JSON.stringify(zuriBookObj, null, 2);
  const updatedCode = prefix + formattedZuriCode + ",\n  " + suffix;
  
  fs.writeFileSync(booksDataPath, updatedCode, 'utf-8');
  console.log(`🎉 100% SUCCESS: Injected all ${chapterObjs.length} chapters of Zuri into booksData.ts!`);
} else {
  console.error("❌ Target insertion points not found in booksData.ts");
}
