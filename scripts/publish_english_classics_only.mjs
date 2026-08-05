import fs from 'fs';
import path from 'path';

const SUPABASE_URL = "https://uamaohjbrjervzsjxwyg.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bLhT1CNl-DrFn_wz6gmp6A_fJPGBY2G";

const headers = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_ANON_KEY,
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
};

const ENGLISH_CLASSICS = [
  {
    slug: "treasure-island",
    title: "Treasure Island",
    author: "Robert Louis Stevenson",
    description: "The classic pirate adventure novel of Jim Hawkins, Long John Silver, and a high-seas search for buried gold. 100% Public Domain English Edition.",
    cover_image: "/covers/watcher_in_westlands.jpg",
    rating: 4.9,
    status: "Completed",
    category: "Adventure",
    tags: ["Pirates", "Adventure", "Treasure", "Classic English"],
    folder_name: "Treasure Island"
  },
  {
    slug: "alices-adventures-in-wonderland",
    title: "Alice's Adventures in Wonderland",
    author: "Lewis Carroll",
    description: "Follow Alice down the rabbit hole into a whimsical world of the White Rabbit, the Mad Hatter, and the Queen of Hearts. 100% Public Domain English Edition.",
    cover_image: "/covers/tides_of_zanzibar.jpg",
    rating: 4.8,
    status: "Completed",
    category: "Fantasy",
    tags: ["Fantasy", "Magic", "Classic English", "Wonderland"],
    folder_name: "Alice's Adventures in Wonderland"
  },
  {
    slug: "grimms-fairy-tales",
    title: "Grimms' Fairy Tales",
    author: "Brothers Grimm",
    description: "The timeless collection of magical fairy tales including Cinderella, Hansel & Gretel, Rapunzel, and the Frog Prince. 100% Public Domain English Edition.",
    cover_image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80",
    rating: 4.9,
    status: "Completed",
    category: "Folk Tales",
    tags: ["Fairy Tales", "Magic", "Classic English"],
    folder_name: "Grimms' Fairy Tales"
  }
];

async function publishEnglishClassicsOnly() {
  console.log("🚀 Publishing Pure English Edition Classics (Treasure Island, Alice, Grimms) to Supabase...");

  for (const b of ENGLISH_CLASSICS) {
    const txtPath = path.join("/Users/yvoche/AI开发/000.非洲最终正文/0.1英文经典", "Standard_Ebooks", b.folder_name, "full_story.txt");
    if (!fs.existsSync(txtPath)) {
      console.error(`❌ Text file not found for ${b.title}: ${txtPath}`);
      continue;
    }
    const fullText = fs.readFileSync(txtPath, 'utf-8');
    const wordCount = fullText.split(/\s+/).length;

    // Check if book exists
    const resGet = await fetch(`${SUPABASE_URL}/rest/v1/books?slug=eq.${b.slug}`, { headers });
    const books = await resGet.json();
    let bookId;

    const bookPayload = {
      slug: b.slug,
      title: b.title,
      author: b.author,
      description: b.description,
      cover_image: b.cover_image,
      rating: b.rating,
      status: b.status,
      category: b.category,
      tags: b.tags,
      word_count: wordCount,
      title_swahili: null,
      description_swahili: null
    };

    if (books && books.length > 0) {
      bookId = books[0].id;
      await fetch(`${SUPABASE_URL}/rest/v1/books?id=eq.${bookId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(bookPayload)
      });
      console.log(`✅ Updated Pure English Metadata: ${b.title}`);
    } else {
      const resIns = await fetch(`${SUPABASE_URL}/rest/v1/books`, {
        method: "POST",
        headers: { ...headers, "Prefer": "return=representation" },
        body: JSON.stringify(bookPayload)
      });
      const newBooks = await resIns.json();
      if (newBooks && newBooks.length > 0) {
        bookId = newBooks[0].id;
      }
      console.log(`✨ Created Pure English Book Entry: ${b.title}`);
    }

    if (bookId) {
      // Clear existing Swahili chapters if any and insert pure English chapters
      await fetch(`${SUPABASE_URL}/rest/v1/chapters?book_id=eq.${bookId}`, {
        method: "DELETE",
        headers
      });

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
            content: currentChapterText.trim(),
            title_swahili: null,
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
          content: currentChapterText.trim(),
          title_swahili: null,
          content_swahili: null
        });
      }

      for (const ch of chaptersToInsert) {
        await fetch(`${SUPABASE_URL}/rest/v1/chapters`, {
          method: "POST",
          headers,
          body: JSON.stringify(ch)
        });
      }
      console.log(`  🎉 Inserted ${chaptersToInsert.length} Pure English chapters for ${b.title}`);
    }
  }
}

publishEnglishClassicsOnly();
