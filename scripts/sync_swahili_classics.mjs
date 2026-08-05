const SUPABASE_URL = "https://uamaohjbrjervzsjxwyg.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bLhT1CNl-DrFn_wz6gmp6A_fJPGBY2G";

const headers = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_ANON_KEY,
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
};

const SWAHILI_CLASSICS = [
  {
    title: "Treasure Island",
    title_swahili: "Kisiwa chenye Hazina",
    author: "Robert Louis Stevenson",
    description: "Riwaya mashuhuri ya matukio ya maharamia wa baharini na utafutaji wa dhahabu iliyofichwa kisiwani. Inayopendwa sana kote Kenya na Afrika Mashariki.",
    cover_image: "/covers/watcher_in_westlands.jpg",
    category: "Adventure",
    chapters: [
      {
        number: 1,
        title: "The Old Sea-dog at the Admiral Benbow",
        title_swahili: "Sura ya 1: Mzee wa Baharini katika Admiral Benbow",
        content_en: "Squire Trelawney, Dr. Livesey, and the rest of these gentlemen having asked me to write down the whole particulars about Treasure Island...",
        content_swahili: "Bwana Trelawney, Daktari Livesey, na mabwana wengine wote waliponiomba niandike maelezo yote kamili kuhusu Kisiwa cha Hazina, kutoka mwanzo hadi mwisho, bila kuficha chochote isipokuwa mahali kilipo kisiwa hicho, na hiyo ni kwa sababu bado kuna hazina iliyobaki huko, ninachukua kalamu yangu mwaka huu wa bwana 17.. na kurudi nyuma hadi wakati ambapo baba yangu alikuwa akimiliki nyumba ya wageni ya Admiral Benbow..."
      },
      {
        number: 2,
        title: "Black Dog Appears and Disappears",
        title_swahili: "Sura ya 2: Mbwa Mweusi Aonekana na Kutoweka",
        content_en: "It was not very long after this that there occurred the first of the mysterious events that rid us at last of the captain...",
        content_swahili: "Haikiwa muda mrefu baada ya hapo ambapo tukio la kwanza la ajabu lilitokea ambalo hatimaye lilituondolea nahodha yule..."
      }
    ]
  },
  {
    title: "Alice's Adventures in Wonderland",
    title_swahili: "Alisi Ndani ya Nchi ya Ajabu",
    author: "Lewis Carroll",
    description: "Mfuatilie Alisi akidondoka kwenye shimo la sungura na kuingia katika ulimwengu wa ajabu wenye maajabu na viumbe vya ajabu.",
    cover_image: "/covers/tides_of_zanzibar.jpg",
    category: "Fantasy",
    chapters: [
      {
        number: 1,
        title: "Down the Rabbit-Hole",
        title_swahili: "Sura ya 1: Kudondoka Kwenye Shimo la Sungura",
        content_en: "Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do...",
        content_swahili: "Alisi alikuwa anaanza kuchoka sana kukaa karibu na dada yake kwenye ukingo wa mto, bila kuwa na kitu cha kufanya. Mara moja au mbili alikuwa amechungulia kitabu ambacho dada yake alikuwa akisoma, lakini kilihusu picha wala mazungumzo..."
      }
    ]
  },
  {
    title: "Grimms' Fairy Tales",
    title_swahili: "Hadithi za Ajabu za Ndugu Grimm",
    author: "Brothers Grimm",
    description: "Mkusanyiko wa hadithi za kusisimua za ajabu zikiwemo Cinderella, Hansel na Gretel, na Rapunzel zilizotafsiriwa kote Afrika Mashariki.",
    cover_image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80",
    category: "Folk Tales",
    chapters: [
      {
        number: 1,
        title: "Cinderella (Cinderella wa Kiswahili)",
        title_swahili: "Sura ya 1: Hadithi ya Cinderella",
        content_en: "The wife of a rich man fell sick, and as she felt that her end was drawing near, she called her only daughter to her bedside...",
        content_swahili: "Mke wa tajiri mmoja aligonjeka, na alipohisi kuwa mwisho wake unakaribia, alimwita binti yake wa pekee kando ya kitanda chake na kumwambia: 'Mwanangu mpendwa, uwe mwema na mwenye stahimilivu, kisha Mungu atakulinda siku zote...'"
      }
    ]
  }
];

async function syncSwahiliClassics() {
  console.log("🚀 Syncing Swahili Version books to Supabase database...");

  for (const b of SWAHILI_CLASSICS) {
    const slug = b.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    // Check if book exists
    const resGet = await fetch(`${SUPABASE_URL}/rest/v1/books?slug=eq.${slug}`, { headers });
    const books = await resGet.json();
    let bookId;

    if (books && books.length > 0) {
      bookId = books[0].id;
      // Patch Swahili fields
      await fetch(`${SUPABASE_URL}/rest/v1/books?id=eq.${bookId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          title_swahili: b.title_swahili,
          description_swahili: b.description_swahili,
          cover_image: b.cover_image
        })
      });
      console.log(`✅ Updated Swahili metadata for: ${b.title} (${b.title_swahili})`);
    } else {
      // Insert new
      const resIns = await fetch(`${SUPABASE_URL}/rest/v1/books`, {
        method: "POST",
        headers: { ...headers, "Prefer": "return=representation" },
        body: JSON.stringify({
          slug,
          title: b.title,
          title_swahili: b.title_swahili,
          author: b.author,
          description: b.description,
          description_swahili: b.description_swahili,
          cover_image: b.cover_image,
          rating: 4.9,
          status: "Completed",
          category: b.category,
          tags: ["Swahili Version", "Classics", "Public Domain"]
        })
      });
      const newBooks = await resIns.json();
      if (newBooks && newBooks.length > 0) {
        bookId = newBooks[0].id;
      }
      console.log(`✨ Created Swahili book entry: ${b.title}`);
    }

    if (bookId) {
      // Upsert chapters with native Swahili content
      for (const ch of b.chapters) {
        const chPayload = {
          book_id: bookId,
          chapter_number: ch.number,
          title: ch.title,
          title_swahili: ch.title_swahili,
          content: ch.content_en,
          content_swahili: ch.content_swahili
        };
        await fetch(`${SUPABASE_URL}/rest/v1/chapters`, {
          method: "POST",
          headers: { ...headers, "Prefer": "resolution=merge-duplicates" },
          body: JSON.stringify(chPayload)
        });
        console.log(`  🎉 Swahili Chapter ${ch.number} synchronized for ${b.title}`);
      }
    }
  }
}

syncSwahiliClassics();
