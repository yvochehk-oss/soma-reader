const STATIC_BOOKS = [
  {
    slug: 'savannahs-secret',
    title: "The Savannah's Secret",
    author: 'Nia Ndlovu',
    category: 'romance',
    language: 'en',
    description: 'When young archivist Zola uncovers a hidden manuscript in the grand library of Nairobi, she is thrust into a century-old mystery that binds her family to a forgotten kingdom.',
    cover_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=800&auto=format&fit=crop',
    chapters: [
      {
        number: 1,
        chapterNumber: 1,
        title: 'The Dust of Ages',
        content: `The afternoon sun bled gold through the high arched windows of Nairobi's McMillan Memorial Library, illuminating millions of dancing dust motes above the dark mahogany shelves. 

Zola adjusted her brass-rimmed spectacles, her fingertips trailing along the spines of bound calfskin volumes that had remained untouched since 1928. Outside, the distant hum of city traffic was a world away from the silent sanctuary of the lower basement vaults.

"You're staying late again, Zola," whispered Chief Archivist Omondi, his voice echoing softly against the stone floor.

"Just finishing cataloging the Delamere family correspondence, Mzee," Zola replied with a warm smile. "Something about volume fourteen doesn't match the registry."`,
        paragraphs: [
          `The afternoon sun bled gold through the high arched windows of Nairobi's McMillan Memorial Library, illuminating millions of dancing dust motes above the dark mahogany shelves.`,
          `Zola adjusted her brass-rimmed spectacles, her fingertips trailing along the spines of bound calfskin volumes that had remained untouched since 1928. Outside, the distant hum of city traffic was a world away from the silent sanctuary of the lower basement vaults.`,
          `"You're staying late again, Zola," whispered Chief Archivist Omondi, his voice echoing softly against the stone floor.`,
          `"Just finishing cataloging the Delamere family correspondence, Mzee," Zola replied with a warm smile. "Something about volume fourteen doesn't match the registry."`
        ]
      },
      {
        number: 2,
        chapterNumber: 2,
        title: 'The Shadow in the Stacks',
        content: `A soft scuffle echoed from aisle four. Zola stiffened, clutching the ancient parchment to her chest.

"Is someone there?" she called into the gloom.

From between the towering stacks of colonial tax records stepped a tall figure, shrouded in a heavy dark wool coat despite the warm equatorial night. His eyes held a luminous amber hue in the ambient streetlamp glow filtering through the transoms.`,
        paragraphs: [
          `A soft scuffle echoed from aisle four. Zola stiffened, clutching the ancient parchment to her chest.`,
          `"Is someone there?" she called into the gloom.`,
          `From between the towering stacks of colonial tax records stepped a tall figure, shrouded in a heavy dark wool coat despite the warm equatorial night. His eyes held a luminous amber hue in the ambient streetlamp glow filtering through the transoms.`
        ]
      }
    ]
  },
  {
    slug: 'savannahs-secret-sw',
    title: 'Siri ya Mbugani',
    author: 'Nia Ndlovu',
    category: 'romance',
    language: 'sw',
    description: 'Zola, mtunza kumbukumbu kijana, anapogundua mswada uliofichwa katika maktaba kuu ya Nairobi, anaingizwa kwenye fumbo la karne moja linaloiunganisha familia yake na ufalme uliosahaulika.',
    cover_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=800&auto=format&fit=crop',
    chapters: [
      {
        number: 1,
        chapterNumber: 1,
        title: 'Vumbi la Enzi',
        content: `Jua la mchana lilimwaga mwanga wa dhahabu kupitia madirisha ya juu ya Maktaba ya Kumbukumbu ya McMillan jijini Nairobi, likiangazia vumbi linalocheza juu ya rafu za mbao nyeusi za mahogani.

Zola alirekebisha miwani yake ya shaba, vidole vyake vikitambaa kando ya pembe za vitabu vilivyofungwa kwa ngozi ambavyo havikuwa vimeguswa tangu mwaka 1928. Nje, sauti ya mbali ya magari ya mjini ilikuwa mbali sana na utulivu wa vyumba vya chini vya maktaba.`,
        paragraphs: [
          `Jua la mchana lilimwaga mwanga wa dhahabu kupitia madirisha ya juu ya Maktaba ya Kumbukumbu ya McMillan jijini Nairobi, likiangazia vumbi linalocheza juu ya rafu za mbao nyeusi za mahogani.`,
          `Zola alirekebisha miwani yake ya shaba, vidole vyake vikitambaa kando ya pembe za vitabu vilivyofungwa kwa ngozi ambavyo havikuwa vimeguswa tangu mwaka 1928. Nje, sauti ya mbali ya magari ya mjini ilikuwa mbali sana na utulivu wa vyumba vya chini vya maktaba.`
        ]
      }
    ]
  },
  {
    slug: 'nairobi-nights-shadows-gold',
    title: 'Nairobi Nights: Shadows & Gold',
    author: 'Kileleshwa Writer',
    category: 'thriller',
    language: 'en',
    description: 'A dark mystery unravels beneath the vibrant neon lights of Westlands.',
    cover_url: 'https://images.unsplash.com/photo-1509021436468-d51039746b42?q=80&w=800&auto=format&fit=crop',
    chapters: [
      {
        number: 1,
        chapterNumber: 1,
        title: 'Neon and Rain',
        content: `Rain hammered against the glass facade of the Westlands high-rise. Below, traffic stretched down Wayaki Way like a glowing red river. Detective Kazi lit a cigarette, staring at the empty vault.`,
        paragraphs: [
          `Rain hammered against the glass facade of the Westlands high-rise. Below, traffic stretched down Wayaki Way like a glowing red river. Detective Kazi lit a cigarette, staring at the empty vault.`
        ]
      }
    ]
  }
];

async function seed() {
  console.log("🚀 Syncing static books into live Supabase database...");

  for (const b of STATIC_BOOKS) {
    const payload = {
      books: [{
        slug: b.slug,
        title: b.title,
        author: b.author,
        language: b.language,
        category: b.category,
        description: b.description,
        status: "published",
        badge: b.language === 'sw' ? '🔥 Kiswahili' : '🔥 Hot',
        chapters: b.chapters,
      }]
    };

    const res = await fetch(`https://read.20140128.xyz/api/internal/book-import`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": "Bearer soma-import-secret-2026",
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    if (res.ok) {
      console.log(`  ✓ Synced "${b.title}" (${b.language}) to Supabase!`);
    } else {
      console.log(`  ! Notice for "${b.title}":`, result.error || res.status);
    }
  }

  console.log("🎉 All static books are now synced to live Supabase database!");
}

seed().catch(console.error);
