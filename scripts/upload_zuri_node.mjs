import fs from 'fs';
import path from 'path';

const SUPABASE_URL = "https://uamaohjbrjervzsjxwyg.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bLhT1CNl-DrFn_wz6gmp6A_fJPGBY2G";

const headers = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_ANON_KEY,
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
};

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

console.log(`📖 Parsed ${en_chapters.length} EN chapters & ${sw_chapters.length} SW chapters.`);

async function fetchWithRetry(url, options = {}, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

const slug = "zuri-queen-of-fashion";

const bookPayload = {
  slug: slug,
  title: "Zuri: Queen of Fashion",
  title_swahili: "Zuri: Malkia wa Mitindo",
  author: "Asha Maridadi",
  description: "Humiliated at a lavish Nairobi banquet after her fiance breaks their engagement, Amina reveals her true identity as Zuri—the international queen of high fashion and corporate power.",
  description_swahili: "Akitukanwa katika karamu ya kifahari ya Nairobi baada ya mchumba wake kuvunja uchumba, Amina anafichua utambulisho wake wa kweli kama Zuri—malkia wa kimataifa wa mitindo na nguvu za kibiashara.",
  cover_image: "/covers/zuri_queen_of_fashion_en.jpg",
  rating: 4.95,
  status: "Completed",
  category: "Romance",
  tags: ["Nairobi Fashion", "Revenge", "Billionaire", "Swahili Romance", "Zuri"]
};

async function uploadZuri() {
  console.log("⚡ Checking/Inserting Zuri metadata into Supabase...");
  
  let bookId;
  const resGet = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/books?slug=eq.${slug}&select=id`, { headers });
  const existingBooks = await resGet.json();

  if (existingBooks && existingBooks.length > 0) {
    bookId = existingBooks[0].id;
    await fetchWithRetry(`${SUPABASE_URL}/rest/v1/books?id=eq.${bookId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(bookPayload)
    });
    console.log(`✅ Updated existing book (ID: ${bookId})`);
  } else {
    const resIns = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/books`, {
      method: "POST",
      headers: { ...headers, "Prefer": "return=representation" },
      body: JSON.stringify(bookPayload)
    });
    const newBooks = await resIns.json();
    bookId = newBooks[0].id;
    console.log(`✨ Inserted new book (ID: ${bookId})`);
  }

  // Delete existing chapters for clean sync
  await fetchWithRetry(`${SUPABASE_URL}/rest/v1/chapters?book_id=eq.${bookId}`, {
    method: "DELETE",
    headers
  });

  const count = Math.max(en_chapters.length, sw_chapters.length);
  console.log(`🚀 Uploading ${count} bilingual chapters...`);

  for (let i = 0; i < count; i++) {
    const en_ch = en_chapters[i] || { title: `Chapter ${i + 1}`, content: "" };
    const sw_ch = sw_chapters[i] || { title: `Sura ya ${i + 1}`, content: "" };

    const chPayload = {
      book_id: bookId,
      chapter_number: i + 1,
      title: en_ch.title,
      title_swahili: sw_ch.title,
      content: en_ch.content,
      content_swahili: sw_ch.content
    };

    await fetchWithRetry(`${SUPABASE_URL}/rest/v1/chapters`, {
      method: "POST",
      headers,
      body: JSON.stringify(chPayload)
    });
    console.log(`  ✨ Chapter ${i + 1}/${count} uploaded!`);
  }

  console.log(`🎉 100% SUCCESS: Uploaded Zuri: Queen of Fashion (${count} chapters) to Supabase!`);
}

uploadZuri();
