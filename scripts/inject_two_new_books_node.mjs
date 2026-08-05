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

const NEW_BOOKS = [
  {
    id: "ninety-minutes-of-darkness",
    title: "Ninety Minutes of Darkness",
    titleSwahili: "Dakika Tisini za Giza",
    author: "Asha Maridadi",
    category: "Thriller",
    rating: 9.8,
    heatMetric: "9.8",
    description: "Trapped during a 90-minute total blackout in a high-tech Nairobi skyscraper, an investigative journalist must outsmart mercenaries to leak corporate secrets.",
    descriptionSwahili: "Akiwa amenasa wakati wa giza nene la dakika 90 katika jumba la ghorofa la kifahari la Nairobi, mwandishi wa habari za uchunguzi lazima awazidi akili mamluki ili kufichua siri za kampuni.",
    coverImage: "/covers/ninety_minutes_of_darkness_en.jpg",
    bannerImage: "/covers/ninety_minutes_of_darkness_en.jpg",
    status: "Hot",
    isEditorChoice: false,
    isBilingualAvailable: true,
    publishedYear: "2026",
    tags: ["Nairobi Thriller", "Blackout", "Suspense", "Swahili Action"],
    en_md_path: path.join(BASE_DIR, "Dakika_Tisini_za_Giza_complete_project", "04_english", "Ninety_Minutes_of_Darkness_final_en.md"),
    sw_md_path: path.join(BASE_DIR, "Dakika_Tisini_za_Giza_complete_project", "03_swahili", "Dakika_Tisini_za_Giza_final_sw.md"),
    en_regex: /^#\s+(Chapter\s+[^:\n]+:?.*?$)/m,
    sw_regex: /^#\s+(Sura\s+ya\s+[^:\n]+:?.*?$)/m
  },
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
    en_md_path: path.join(BASE_DIR, "Hati_ya_Mwisho_complete_project", "04_english", "The_Last_Title_Deed_final_en.md"),
    sw_md_path: path.join(BASE_DIR, "Hati_ya_Mwisho_complete_project", "03_swahili", "Hati_ya_Mwisho_final_sw.md"),
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

  for (const b of NEW_BOOKS) {
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
        releaseDate: '2026-07-31',
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

    // 2. Inject into booksData.ts if not present
    if (!code.includes(`id: '${b.id}'`)) {
      const insertPos = code.indexOf("export const BOOKS_DATA: Book[] = [") + "export const BOOKS_DATA: Book[] = [".length;
      const formattedCode = "\n  " + JSON.stringify(fullBookObj, null, 2) + ",";
      code = code.slice(0, insertPos) + formattedCode + code.slice(insertPos);
      console.log(`  ✨ Injected ${b.title} (${chapterObjs.length} chapters) into booksData.ts!`);
    }
  }

  fs.writeFileSync(booksDataPath, code, 'utf-8');
  console.log("🎉 100% SUCCESS: Both new books fully published & injected!");
}

processBooks();
