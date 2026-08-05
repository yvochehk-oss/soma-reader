import fs from 'fs';
import path from 'path';

const SUPABASE_URL = "https://uamaohjbrjervzsjxwyg.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bLhT1CNl-DrFn_wz6gmp6A_fJPGBY2G";

const headers = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_ANON_KEY,
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
};

const BASE_DIR = "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文";

const BOOKS = [
  {
    id: "the-last-title-deed",
    title: "The Last Title Deed",
    titleSwahili: "Hati ya Mwisho",
    author: "Asha Maridadi",
    category: "Contemporary",
    rating: 9.9,
    heatMetric: "9.9",
    description: "When a powerful land-grabbing cartel tries to seize her family's ancestral Rift Valley ranch, a fiercely determined young lawyer fights back with the ultimate title deed.",
    descriptionSwahili: "Kundi lenye nguvu la mabwanyenye wa ardhi linapojaribu kunyakua shamba la familia yake katika Bonde la Ufa, mwanasheria kijana mwenye msimamo mkali anapambana kwa kutumia hati ya mwisho ya ardhini.",
    coverImage: "/covers/the_last_title_deed_en.jpg",
    bannerImage: "/covers/the_last_title_deed_en.jpg",
    status: "Hot",
    isEditorChoice: false,
    isBilingualAvailable: true,
    publishedYear: "2026",
    tags: ["Rift Valley", "Legal Drama", "Heritage", "Swahili Romance"],
    en_md_path: path.join(BASE_DIR, "Hati_ya_Mwisho_complete_project-2", "04_english", "The_Last_Title_Deed_final_en.md"),
    sw_md_path: path.join(BASE_DIR, "Hati_ya_Mwisho_complete_project-2", "03_swahili", "Hati_ya_Mwisho_final_sw.md"),
    en_regex: /^#\s+(Chapter\s+[^:\n]+:?.*?$)/m,
    sw_regex: /^#\s+(Sura\s+ya\s+[^:\n]+:?.*?$)/m
  },
  {
    id: "voices-beneath-the-baobab",
    title: "Voices Beneath the Baobab",
    titleSwahili: "Sauti Chini ya Mbuyu",
    author: "Zahra Bahari",
    category: "Urban Fantasy",
    rating: 9.9,
    heatMetric: "9.9",
    description: "Deep in the coastal forests of Kenya, an ancient Baobab tree begins to whisper long-forgotten secrets of ancestral power, binding a young woman's destiny to a hidden sacred order.",
    descriptionSwahili: "Ndani ya misitu ya pwani ya Kenya, mti wa zamani wa Mbuyu unaanza kunong'ona siri zilizosahaulika kwa muda mrefu za nguvu za mababu, ukifunga hatima ya msichana mdogo kwenye agano la siri.",
    coverImage: "/covers/voices_beneath_the_baobab_en.jpg",
    bannerImage: "/covers/voices_beneath_the_baobab_en.jpg",
    status: "Hot",
    isEditorChoice: true,
    isBilingualAvailable: true,
    publishedYear: "2026",
    tags: ["Baobab Secrets", "Coastal Kenya", "Ancestral Magic", "Swahili Fantasy"],
    en_md_path: path.join(BASE_DIR, "Sauti_Chini_ya_Mbuyu_complete_project_v2_1-2", "04_english", "Voices_Beneath_the_Baobab_final_en_expanded_v2_1.md"),
    sw_md_path: path.join(BASE_DIR, "Sauti_Chini_ya_Mbuyu_complete_project_v2_1-2", "03_swahili", "Sauti_Chini_ya_Mbuyu_final_sw_expanded_v2_1.md"),
    en_regex: /^#\s+(Chapter\s+[^:\n]+:?.*?$)/m,
    sw_regex: /^#\s+(Sura\s+ya\s+[^:\n]+:?.*?$)/m
  }
];

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

async function processBooks() {
  const booksDataPath = path.join(process.cwd(), "src", "data", "booksData.ts");
  let code = fs.readFileSync(booksDataPath, 'utf-8');

  for (const b of BOOKS) {
    const en_text = fs.readFileSync(b.en_md_path, 'utf-8');
    const sw_text = fs.readFileSync(b.sw_md_path, 'utf-8');

    const en_ch = parseChapters(en_text, b.en_regex);
    const sw_ch = parseChapters(sw_text, b.sw_regex);

    console.log(`📖 [${b.title}] Parsed ${en_ch.length} EN & ${sw_ch.length} SW chapters.`);

    const max_ch = Math.max(en_ch.length, sw_ch.length);
    const chapterObjs = [];

    for (let idx = 0; idx < max_ch; idx++) {
      const en = en_ch[idx] || { title: `Chapter ${idx + 1}`, content: "" };
      const sw = sw_ch[idx] || { title: `Sura ya ${idx + 1}`, content: "" };

      chapterObjs.push({
        id: `${b.id}-ch${idx + 1}`,
        number: idx + 1,
        title: en.title,
        titleSwahili: sw.title,
        releaseDate: '2026-08-01',
        wordCount: en.content.split(/\s+/).length,
        content: en.content,
        contentSwahili: sw.content
      });
    }

    const fullBookObj = {
      id: b.id,
      title: b.title,
      titleSwahili: b.titleSwahili,
      author: b.author,
      category: b.category,
      rating: b.rating,
      heatMetric: b.heatMetric,
      description: b.description,
      descriptionSwahili: b.descriptionSwahili,
      coverImage: b.coverImage,
      bannerImage: b.bannerImage,
      status: b.status,
      isEditorChoice: b.isEditorChoice,
      isBilingualAvailable: b.isBilingualAvailable,
      publishedYear: b.publishedYear,
      chaptersCount: chapterObjs.length,
      tags: b.tags,
      chapters: chapterObjs
    };

    // 1. Supabase Upload
    const supabasePayload = {
      slug: b.id,
      title: b.title,
      author_name: b.author,
      description: b.description,
      cover_url: b.coverImage,
      language_code: "en",
      category: b.category.toLowerCase(),
      status: "published",
      is_featured: true,
      total_chapters: chapterObjs.length
    };

    console.log(`⚡ Syncing ${b.title} to Supabase...`);
    await fetch(`${SUPABASE_URL}/rest/v1/books`, {
      method: "POST",
      headers: { ...headers, "Prefer": "resolution=merge-duplicates" },
      body: JSON.stringify(supabasePayload)
    });

    const resGet = await fetch(`${SUPABASE_URL}/rest/v1/books?slug=eq.${b.id}&select=id`, { headers });
    const books = await resGet.json();
    if (books && books.length > 0) {
      const bookId = books[0].id;
      await fetch(`${SUPABASE_URL}/rest/v1/chapters?book_id=eq.${bookId}`, { method: "DELETE", headers });
      for (const ch of chapterObjs) {
        await fetch(`${SUPABASE_URL}/rest/v1/chapters`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            book_id: bookId,
            chapter_number: ch.number,
            title: ch.title,
            content: ch.content,
            status: "published",
            is_free: true,
            word_count: ch.wordCount
          })
        });
      }
      console.log(`  ✅ Supabase chapters synced for ${b.title}!`);
    }

    // 2. Replace or Inject into booksData.ts
    const searchId = `id: '${b.id}'`;
    if (code.includes(searchId)) {
      const startIdx = code.indexOf(searchId);
      const objStart = code.lastIndexOf('{', startIdx);
      // Find matching closing bracket for book object
      let braceCount = 0;
      let objEnd = -1;
      for (let i = objStart; i < code.length; i++) {
        if (code[i] === '{') braceCount++;
        else if (code[i] === '}') braceCount--;
        if (braceCount === 0) {
          objEnd = i + 1;
          break;
        }
      }
      if (objEnd !== -1) {
        const formattedCode = JSON.stringify(fullBookObj, null, 2);
        code = code.slice(0, objStart) + formattedCode + code.slice(objEnd);
        console.log(`  ✨ Replaced and updated ${b.title} (${chapterObjs.length} chapters) in booksData.ts!`);
      }
    } else {
      const insertPos = code.indexOf("export const BOOKS_DATA: Book[] = [") + "export const BOOKS_DATA: Book[] = [".length;
      const formattedCode = "\n  " + JSON.stringify(fullBookObj, null, 2) + ",";
      code = code.slice(0, insertPos) + formattedCode + code.slice(insertPos);
      console.log(`  ✨ Injected ${b.title} (${chapterObjs.length} chapters) into booksData.ts!`);
    }
  }

  fs.writeFileSync(booksDataPath, code, 'utf-8');
  console.log("🎉 100% SUCCESS: Today's 2 updated books fully published & injected!");
}

processBooks();
