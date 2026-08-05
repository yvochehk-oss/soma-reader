import fs from 'fs';
import path from 'path';

const SUPABASE_URL = "https://uamaohjbrjervzsjxwyg.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bLhT1CNl-DrFn_wz6gmp6A_fJPGBY2G";

const headers = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_ANON_KEY,
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
  "Prefer": "resolution=merge-duplicates"
};

const TOP3_BOOKS = [
  {
    slug: "treasure-island",
    title: "Treasure Island",
    title_swahili: "Kisiwa chenye Hazina",
    author: "Robert Louis Stevenson",
    description: "The classic pirate adventure novel of Jim Hawkins, Long John Silver, and a high-seas search for buried gold. Highly beloved across Kenya & East Africa since 1965.",
    description_swahili: "Riwaya mashuhuri ya matukio ya maharamia wa baharini na utafutaji wa dhahabu iliyofichwa kisiwani. Inayopendwa sana kote Kenya na Afrika Mashariki tangu 1965.",
    cover_image: "/covers/watcher_in_westlands.jpg",
    rating: 4.9,
    status: "Completed",
    category: "Adventure",
    tags: ["Pirates", "Adventure", "Treasure", "Swahili Classic"],
    folder_name: "Treasure Island"
  },
  {
    slug: "alices-adventures-in-wonderland",
    title: "Alice's Adventures in Wonderland",
    title_swahili: "Alisi Ndani ya Nchi ya Ajabu",
    author: "Lewis Carroll",
    description: "Follow Alice down the rabbit hole into a whimsical world of the White Rabbit, the Mad Hatter, and the Queen of Hearts.",
    description_swahili: "Mfuatilie Alisi akidondoka kwenye shimo la sungura na kuingia katika ulimwengu wa ajabu wenye maajabu na viumbe vya ajabu.",
    cover_image: "/covers/tides_of_zanzibar.jpg",
    rating: 4.8,
    status: "Completed",
    category: "Fantasy",
    tags: ["Fantasy", "Magic", "Swahili Classic", "Wonderland"],
    folder_name: "Alice's Adventures in Wonderland"
  },
  {
    slug: "grimms-fairy-tales",
    title: "Grimms' Fairy Tales",
    title_swahili: "Hadithi za Ajabu za Ndugu Grimm",
    author: "Brothers Grimm",
    description: "The timeless collection of magical fairy tales including Cinderella, Hansel & Gretel, Rapunzel, and the Frog Prince.",
    description_swahili: "Mkusanyiko wa hadithi za kusisimua za ajabu zikiwemo Cinderella, Hansel na Gretel, na Rapunzel zilizotafsiriwa kote Afrika Mashariki.",
    cover_image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80",
    rating: 4.9,
    status: "Completed",
    category: "Folk Tales",
    tags: ["Fairy Tales", "Magic", "Swahili Classic", "Classics"],
    folder_name: "Grimms' Fairy Tales"
  }
];

async function publishTop3() {
  console.log("🚀 Publishing Top 3 Classics (Treasure Island, Alice, Grimms) to Supabase...");

  for (const b of TOP3_BOOKS) {
    const txtPath = path.join("/Users/yvoche/AI开发/000.非洲最终正文/0.1英文经典", "Standard_Ebooks", b.folder_name, "full_story.txt");
    if (!fs.existsSync(txtPath)) {
      console.error(`❌ Text file not found for ${b.title}: ${txtPath}`);
      continue;
    }
    const fullText = fs.readFileSync(txtPath, 'utf-8');
    const wordCount = fullText.split(/\s+/).length;

    // 1. Upsert Book Metadata into Supabase
    const bookPayload = {
      slug: b.slug,
      title: b.title,
      title_swahili: b.title_swahili,
      author: b.author,
      description: b.description,
      description_swahili: b.description_swahili,
      cover_image: b.cover_image,
      rating: b.rating,
      status: b.status,
      category: b.category,
      tags: b.tags,
      word_count: wordCount
    };

    const resBook = await fetch(`${SUPABASE_URL}/rest/v1/books`, {
      method: "POST",
      headers,
      body: JSON.stringify(bookPayload)
    });

    if (!resBook.ok) {
      console.warn(`Book upsert warning for ${b.title}: ${await resBook.text()}`);
    } else {
      console.log(`✅ Successfully published Book Metadata: ${b.title} (${b.title_swahili})`);
    }

    // 2. Fetch inserted book_id
    const resGet = await fetch(`${SUPABASE_URL}/rest/v1/books?slug=eq.${b.slug}&select=id`, { headers });
    const books = await resGet.json();
    if (!books || books.length === 0) continue;
    const bookId = books[0].id;

    // 3. Split full story into digestible chapters (approx 2500 words per chapter)
    const paragraphs = fullText.split(/\n\s*\n/);
    let chapterIndex = 1;
    let currentChapterText = "";
    let currentWordCount = 0;
    const chaptersToInsert = [];

    for (const p of paragraphs) {
      currentChapterText += p + "\n\n";
      currentWordCount += p.split(/\s+/).length;

      if (currentWordCount >= 2500) {
        chaptersToInsert.push({
          book_id: bookId,
          chapter_number: chapterIndex,
          title: `Chapter ${chapterIndex}`,
          title_swahili: `Sura ya ${chapterIndex}`,
          content: currentChapterText.trim(),
          content_swahili: null
        });
        chapterIndex++;
        currentChapterText = "";
        currentWordCount = 0;
      }
    }

    if (currentChapterText.trim().length > 0) {
      chaptersToInsert.push({
        book_id: bookId,
        chapter_number: chapterIndex,
        title: `Chapter ${chapterIndex}`,
        title_swahili: `Sura ya ${chapterIndex}`,
        content: currentChapterText.trim(),
        content_swahili: null
      });
    }

    // Insert chapters in batch
    for (const ch of chaptersToInsert) {
      await fetch(`${SUPABASE_URL}/rest/v1/chapters`, {
        method: "POST",
        headers,
        body: JSON.stringify(ch)
      });
    }
    console.log(`  🎉 Successfully inserted ${chaptersToInsert.length} chapters for ${b.title}`);
  }
}

publishTop3();
