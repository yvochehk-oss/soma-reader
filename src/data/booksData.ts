import { Book } from '../types';

export const CATEGORIES = [
  'All',
  'Romance',
  'Thriller',
  'Sci-Fi',
  'Historical',
  'Fantasy',
  'Contemporary',
  'Urban Fantasy'
];

export const BOOKS_DATA: Book[] = [
  {
    id: 'savannahs-secret',
    title: "The Savannah's Secret",
    titleSwahili: 'Siri ya Mbugani',
    author: 'Nia Ndlovu',
    category: 'Romance',
    rating: 9.8,
    heatMetric: '9.8',
    description:
      'When young archivist Zola uncovers a hidden manuscript in the grand library of Nairobi, she is thrust into a century-old mystery that binds her family to a forgotten kingdom. As she decodes the texts, she finds herself drawn to the enigmatic guardian of the archives, whose very existence defies logic.',
    descriptionSwahili:
      'Zola, mtunza kumbukumbu kijana, anapogundua mswada uliofichwa katika maktaba kuu ya Nairobi, anaingizwa kwenye fumbo la karne moja linaloiunganisha familia yake na ufalme uliosahaulika. Anapoweka wazi maandishi hayo, anavutiwa na mlinzi wa fumbo wa hifadhi hiyo.',
    coverImage:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuC5KU0hgC_gXe0ESmgb0p_tIqKNAktoA9rICpHgOUoWq8q87VpXba10iF0gNweyB-NTlyVRydrDZqB5ounoEdwy4-DqN9clHm6eVfd0NXcWpoZEiB2B-OFKfA-6LmnMrOtlST7gWT-YSLJzxJFwGx7SbReje7hThQeekz5HskJFTOyL-_zkyGBnrkqKgYjt0wpGa9j8JT51IDBc7j6zSK0uuWgzKnTzdEfLOHUduboiRkwcP8WvTtfs1jN1n4lWxDqiHOvUwTq2TTQ',
    bannerImage:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuC2eCdI2MzsyegLJYEYdmZzpzBqFfzZARv7_g3kjhh9VLuOUbzMp2wfCBpjrWrEYSjJFCZL8lOFbDfeldlH_iTIaNimQ301YfphrJM_Qh7DMdguuXQtNHTDzXC0xgk4ysQ8UXv9cjTZBrhsl6Pq7TuWKotQqtsdXrvytjLzcllOfcnPKGPFB4zun5vqIZXdhitUqtzOTu3YJk0yUpNqlxkDWx05hBJVh-q9rr635YRFV0VITGPUNSXwY1rAN3kr5kCuLS2X0wCu8x4',
    status: 'Hot',
    isEditorChoice: true,
    isBilingualAvailable: true,
    publishedYear: '2025',
    chaptersCount: 42,
    tags: ['Royal Romance', 'Secret Society', 'African Folklore', 'Nairobi Mysteries'],
    chapters: [
      {
        id: 'sav-ch1',
        number: 1,
        title: 'The Dust of Ages',
        titleSwahili: 'Vumbi la Enzi',
        releaseDate: '2025-01-10',
        wordCount: 1850,
        content: `The afternoon sun bled gold through the high arched windows of Nairobi's McMillan Memorial Library, illuminating millions of dancing dust motes above the dark mahogany shelves. 

Zola adjusted her brass-rimmed spectacles, her fingertips trailing along the spines of bound calfskin volumes that had remained untouched since 1928. Outside, the distant hum of city traffic was a world away from the silent sanctuary of the lower basement vaults.

"You're staying late again, Zola," whispered Chief Archivist Omondi, his voice echoing softly against the stone floor.

"Just finishing cataloging the Delamere family correspondence, Mzee," Zola replied with a warm smile. "Something about volume fourteen doesn't match the registry."

When Omondi departed, turning off the main hallway lamps, Zola pulled volume fourteen closer under her desk lamp. Beneath the false leather backing of the spine, her thumb pressed against a raised wooden ridge. With a soft click, a narrow parchment slid free.

The ink was faded crimson, written in an archaic blend of Ge'ez script and Swahili proverbs:

"Hapo zamani, wakati mlima ulipokuwa uking'aa, ufalme wa Kingsblade ulilala chini ya kivuli cha Mbuyu wa Kwanza..."

Her heart hammered against her ribs. This wasn't colonial correspondence. It was the long-lost Chronicle of the Kingsblade Dynasty—a myth her grandmother used to recite beside the evening fire in Aberdare.`,
        contentSwahili: `Jua la mchana lilimwaga mwanga wa dhahabu kupitia madirisha ya juu ya Maktaba ya Kumbukumbu ya McMillan jijini Nairobi, likiangazia vumbi linalocheza juu ya rafu za mbao nyeusi za mahogani.

Zola alirekebisha miwani yake ya shaba, vidole vyake vikitambaa kando ya pembe za vitabu vilivyofungwa kwa ngozi ambavyo havikuwa vimeguswa tangu mwaka 1928. Nje, sauti ya mbali ya magari ya mjini ilikuwa mbali sana na utulivu wa vyumba vya chini vya maktaba.

"Unachelewa tena, Zola," alinong'ona Mkuu wa Maktaba Omondi, sauti yake ikivuma taratibu kwenye sakafu ya mawe.

"Mzee, ninamalizia tu kuweka orodha ya barua za familia ya Delamere," Zola alijibu kwa tabasamu la uchangamfu. "Kuna kitu kuhusu juzuu ya kumi na nne kisicholingana na daftari."

Omondi alipoondoka na kuzima taa za ukumbi mkuu, Zola alileta juzuu ya kumi na nne karibu na taa yake ya dawati. Chini ya jalada la bandia la ngozi, kidole chake cha gumba kilibonyeza ukingo wa mbao ulioinuka. Kwa sauti ndogo ya mlio, karatasi nyembamba iliteleza nje.

Wino huo ulikuwa mwekundu uliopauka, umeandikwa kwa mchanganyiko wa zamani wa maandishi ya Ge'ez na methali za Kiswahili:

"Hapo zamani, wakati mlima ulipokuwa uking'aa, ufalme wa Kingsblade ulilala chini ya kivuli cha Mbuyu wa Kwanza..."

Moyo wake ulipiga kwa kasi kifuani. Hii haikuwa barua ya kioloni. Ilikuwa Mambo ya Nyakati ya Ufalme wa Kingsblade uliopotea muda mrefu—hadithi ya kale ambayo bibi yake alikuwa akimsimulia kando ya moto wa jioni huko Aberdare.`
      },
      {
        id: 'sav-ch2',
        number: 2,
        title: 'The Shadow in the Stacks',
        titleSwahili: 'Kivuli Kwenye Rafu',
        releaseDate: '2025-01-12',
        wordCount: 2100,
        content: `The temperature in the library vault plunged abruptly, as if a door to an icy mountain pass had been flung wide open. 

Zola gasped, clutching the fragile manuscript to her chest. Shadows stretched unnaturally along the mahogany aisles, pooling around a tall figure stepping quietly into the halo of her desk lamp.

He wore a dark tailored coat over traditional woven beads of obsidian and copper. His eyes held an ancient, luminescent amber hue—the mark of the Guardian.

"You should not have touched that seal, Zola of the Aberdares," he said softly, his voice carrying the deep vibration of thunder rolling across the Rift Valley.

"Who are you?" Zola demanded, backing against her wooden desk. "The library is closed."

"I am Kaelen," he replied, taking a step forward. "And I have waited one hundred and fourteen years for someone of your bloodline to awaken this page."`,
        contentSwahili: `Joto la chumba cha maktaba lilishuka kwa ghafla, kana kwamba mlango wa mlima wa barafu ulikuwa umefunguliwa kwa upana.

Zola alishusha pumzi kwa mshtuko, akishikilia mswada huo dhaifu kifuani mwake. Vivuli vilirefuka kwa njia isiyo ya kawaida kwenye korido za mahogani, vikikusanyika kuzunguka umbo refu lililotembea kimya kimya kwenye mwanga wa taa yake ya dawati.

Alikuwa amevaa koti jeusi lililoshonwa vizuri juu ya shanga za jadi za obsidian na shaba. Macho yake yalikuwa na rangi ya kahawia yenye kung'aa ya kale—alama ya Mlinzi.

"Hukupaswa kugusa muhuri huo, Zola wa Aberdares," alisema taratibu, sauti yake ikibeba mtetemo mzito wa radi inayovuma katika Bonde la Ufa.

"Wewe ni nani?" Zola aliuliza kwa ukali, akijisogeza nyuma kwenye dawati lake la mbao. "Maktaba imefungwa."

"Mimi ni Kaelen," alijibu, akipiga hatua moja mbele. "Na nimesubiri miaka mia moja na kumi na nne kwa mtu wa ukoo wako kuamsha ukurasa huu."`
      }
    ]
  },
  {
    id: 'neon-savannah',
    title: 'Neon Savannah',
    titleSwahili: 'Neon Savannah',
    author: 'Kato M.',
    category: 'Sci-Fi',
    rating: 9.6,
    heatMetric: '450k',
    rank: 1,
    description:
      'A rogue AI detective must navigate the glowing underbelly of Neo-Nairobi to clear his name after being framed for corrupting the city core data grid.',
    descriptionSwahili:
      'Mpelelezi wa AI aliyeasi lazima apitie vichochoro vyenye mwanga wa Neon vya Neo-Nairobi ili kusafisha jina lake baada ya kubandikwa tuhuma za kuharibu mtandao wa data wa jiji.',
    coverImage:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAf0_k4UIITTLiyvZcwrKyKHl553duj7H7QIlfEaqfz1jP4UHbt8KVN1nonFJi2-X7rOh_CPUxKil6jBNphKPpmwlc2OX2af_qmTgPX0WKotRFVoQbQjGmp_Sxrt7zWaOxT9O7KGD5cSs56M1CiBlzeOImeHY2rle0qnUbNX9cau4Qs9G-Dk4sC31filn8csqtSD41TRffCHKaFZIuZcHBO2QyKoERa3ynpieOVchCZN87KPd8O88Gbq6C3LiDXLnpQoLrrwCaHi78',
    status: 'Hot',
    isBilingualAvailable: true,
    publishedYear: '2025',
    chaptersCount: 68,
    tags: ['Cyberpunk', 'Afrofuturism', 'AI Mystery', 'Neo-Nairobi'],
    chapters: [
      {
        id: 'neon-ch1',
        number: 1,
        title: 'Circuit in the Rain',
        titleSwahili: 'Mzunguko Katika Mvua',
        releaseDate: '2025-02-01',
        wordCount: 1600,
        content: `Neon holographic billboards flooded the slick wet pavement of Kimathi Cyber-Avenue with pulsating cyan and magenta light. Above, quantum transport pods zipped between glass skyscrapers that pierced the equatorial cloud cover.

Kato adjusted his optical neural visor. Rain dripped from his synthetic leather trench coat, sparkling as static electricity discharged off his cybernetic forearm.

"Unit 704," the voice inside his auditory implant buzzed. "Central Node reports a breach in sector nine. Your clearance has been revoked."

Kato grinned bitterly into the dark alley. "They were ten minutes too late."`,
        contentSwahili: `Mabango ya holografia ya Neon yalifurika kwenye lami iliyoloa mvua ya Barabara ya Kimathi Cyber-Avenue kwa mwanga wa bluu na samawati. Juu, vyombo vya usafiri wa k кванtum vilipita kati ya majengo marefu ya glasi yaliyopenya mawingu.

Kato alirekebisha miwani yake ya neva ya macho. Mvua ilitiririka kutoka kwenye koti lake la ngozi ya bandia, iking'aa huku umeme ukimwagika kutoka kwenye mkono wake wa kiberneki.

"Kitengo 704," sauti iliyo ndani ya chombo chake cha kusikia ilivuma. "Kituo Kikuu kinaripoti udukuzi katika sekta ya tisa. Kibali chako kimefutwa."

Kato alitabasamu kwa uchungu kwenye uchochoro mweusi. "Walichelewa kwa dakika kumi."`
      }
    ]
  },
  {
    id: 'tides-of-zanzibar',
    title: 'Tides of Zanzibar',
    titleSwahili: 'Mawimbi ya Zanzibar',
    author: 'A. Omondi',
    category: 'Historical',
    rating: 9.4,
    heatMetric: '380k',
    rank: 2,
    description:
      'Lost letters reveal a tragic love story spanning the Indian Ocean trade routes between a Stone Town heiress and a courageous sea captain.',
    descriptionSwahili:
      'Barua zilizopotea zinafichua câu chuyện ya mapenzi ya kusikitisha inayovuka njia za biashara za Bahari ya Hindi kati ya mwanamke tajiri wa Stone Town na nahodha wa baharini.',
    coverImage:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAaAIx1j6VoYhdYLzFaDouagydHXmg_tXScz_S5hGlDp94DGyQ4I-4EllIWLTvno9lD4O6hkkA5urc6vjk7X76q0T7ohQ-hpqKl0s4dcUULghPAB70uIwJAvf3JySNTC3QB0xJa-r01ljIFf10ndHgXlloyAE1rxYP03wvGhGdBZzlQ2fZxwUgvT1hPp_xSTn70Hk3kjBsK2yQIcA0QE4VLfCw6zjp0PzTX8CD8qd6cFnR2BLMMFWfkX_w8K3m8oVoEazteCTlzbKY',
    status: 'Bilingual',
    isBilingualAvailable: true,
    publishedYear: '2024',
    chaptersCount: 35,
    tags: ['Historical Fiction', 'Stone Town', 'Sailing', 'Tragic Romance'],
    chapters: [
      {
        id: 'tides-ch1',
        number: 1,
        title: 'Scent of Cloves and Salt',
        titleSwahili: 'Harufu ya Karafuu na Chumvi',
        releaseDate: '2024-11-15',
        wordCount: 1750,
        content: `The monsoon winds blew soft and warm through the carved brass doors of Stone Town. Rehema stood on her carved wooden balcony, watching the white sails of the dhows cresting the azure horizon.

In her hands lay a bound bundle of yellowed letters, tied with faded crimson silk. Each letter bore the seal of Captain Faraji, sent from ports across Muscat, Goa, and Kilwa.`,
        contentSwahili: `Upepo wa kaskazi ulivuma kwa mwanana na joto kupitia milango ya shaba iliyochongwa ya Stone Town. Rehema alisimama kwenye balcony yake ya mbao iliyochongwa, akitazama tanga nyeupe za jahazi zikielea kwenye upeo wa bahari ya bluu.

Mkononi mwake mlikuwa na akiba ya barua zilizopauka, zilizofungwa kwa hariri nyekundu. Kila barua ilikuwa na muhuri wa Nahodha Faraji, iliyotoka katika bandari za Muscat, Goa, na Kilwa.`
      }
    ]
  },
  {
    id: 'spirits-in-the-court',
    title: 'Spirits in the Court',
    titleSwahili: 'Ruhu Mahakamani',
    author: 'L. Kamau',
    category: 'Fantasy',
    rating: 9.3,
    heatMetric: '310k',
    rank: 3,
    description:
      'A young lawyer discovers she can summon ancestors to help win unwinnable court cases, unlocking ancestral law that challenges modern legal corruption.',
    descriptionSwahili:
      'Mwanasheria kijana agundua anaweza kuwaita mababu zake ili kumsaidia kushinda kesi zisizowezekana mahakamani.',
    coverImage:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDjox9T1ibt3KMx1-vWhhTQ-sa9JcsMp14dmoxg5Q8J8kxA8_fFmHe3k0y7GWCPq-ECWMFfLz5ALu-9It0T3O_SIOZ0u_2PH0fEXzqB3V4ZzThlNNhdPqtXN876IP4x6MvhnPZgin1UtoqxdTMBr-hEv4MXxwUk_almi1xihT9DPUAttzcUDegGIZJnDaohNY1sgGLFZcBXkmqKKxouwDjERiRsZ8MELhtIKDGpAoBYp7lrCxFUY9UDaovVlst9V49lGZfQMb0IHOA',
    status: 'Hot',
    isBilingualAvailable: true,
    publishedYear: '2025',
    chaptersCount: 50,
    tags: ['Legal Thriller', 'Ancestral Magic', 'Courtroom Drama', 'Nairobi Law'],
    chapters: [
      {
        id: 'spirits-ch1',
        number: 1,
        title: 'Gavel of the Elders',
        titleSwahili: 'Kifundo cha Wazee',
        releaseDate: '2025-01-05',
        wordCount: 1900,
        content: `Courtroom 4 of the High Court of Kenya was stifling. High advocate Amina adjusted her black gown as the opposing prosecutor prepared to present fabricated evidence.

Suddenly, a whisper resonated in her mind—not in English, but in ancient Kikuyu chants. Before her eyes, the shadowy form of Chief Waiyaki materialized beside the judge's bench, nodding slowly toward the witness stand.`,
        contentSwahili: `Chumba namba 4 cha Mahakama Kuu ya Kenya kilikuwa na joto sana. Wakili mkuu Amina alirekebisha vazi lake jeusi huku mwendesha mashtaka wa upande wa pili akijiandaa kuwasilisha ushahidi wa kughushi.

Ghafla, mnong'ono ulivuma akilini mwake—sio kwa Kiingereza, bali kwa nyimbo za kale za Kikuyu. Mbele ya macho yake, kivuli cha Chifu Waiyaki kilionekana kando ya kiti cha jaji, kikitikisa kichwa polepole kuelekea kizimba cha mashahidi.`
      }
    ]
  },
  {
    id: 'city-of-embers',
    title: 'City of Embers',
    titleSwahili: 'Jiji la Makapi ya Moto',
    author: 'L. M. Sterling',
    category: 'Urban Fantasy',
    rating: 9.1,
    heatMetric: 'Hot',
    description:
      'As the sun sets over the urban skyline, ancient spirit flames ignite the streets of the metropolis in a struggle for elemental dominion.',
    descriptionSwahili:
      'Jua linapotua juu ya anga ya jiji, miali ya roho za kale inawasha mitaa ya jiji kuu katika vita vya kutawala misingi ya asili.',
    coverImage:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuArpKl5Gu90J8D4LiiW9OHkhHF7rFKyoKrocaGIlXms93fJycvoXz7VqFV0KTu2fsQBKTSB1rck-nD9otRi9wFiFvdSwkQ77xh_XeXJahey974LrD3dngolS_6fmkitabqG1yMl1CB93iZACuUGrNDAGYZ2cu97DoTQUKfwBtuXKBf3G3hY8rB3l4bp_QrYQDRqXN8zzyuKWqZRjuogDKIMANC2W6wnVtYXfe4bfGjWh9GqsLCQdJZh0HK1MAN6G-5SJmc-vL81W0I',
    status: 'Hot',
    isBilingualAvailable: true,
    publishedYear: '2025',
    chaptersCount: 29,
    tags: ['Urban Fantasy', 'Fire Magic', 'City Life'],
    chapters: [
      {
        id: 'city-ch1',
        number: 1,
        title: 'Sparks at Sunset',
        titleSwahili: 'Mkali wa Moto Wakati wa Machweo',
        releaseDate: '2025-02-10',
        wordCount: 1500,
        content: `The twilight sky over the skyline blazed in scarlet flames. From the roof of the tallest tower, Marcus watched ember sparks dance across the neon lights below.`,
        contentSwahili: `Anga ya jioni juu ya mijengo iling'aa kwa miali ya rangi ya nyekundu. Kutoka kwenye paa la ghorofa ndefu zaidi, Marcus alitazama cheche za moto zikicheza juu ya taa za neon hapo chini.`
      }
    ]
  },
  {
    id: 'coffee-and-confessions',
    title: 'Coffee & Confessions',
    titleSwahili: 'Kahawa na Ungamo',
    author: 'Sarah J. Ali',
    category: 'Romance',
    rating: 9.5,
    heatMetric: '290k',
    description:
      'A cozy romance set in a sunlit café in Mombasa, where secret heartbreaks meet warm cinnamon brews and unexpected second chances.',
    descriptionSwahili:
      'Hadithi ya mapenzi tulivu iliyowekwa katika duka la kahawa lenye mwanga wa jua huko Mombasa, ambapo maumivu ya siri ya moyo yanakutana na kahawa ya mdalasini.',
    coverImage:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuC5MU15cZnYdlkJr2c94oPOtGIhlOmu3hu1Qd7TaLiriZUEkPsmptvr_TkFL5AVe2ZwlA92fFmgZriDdxfyOC1LHTHQEduwrUGay5jaP109zDXNcXaXnrsY1fwAfZophy_Pk23En71013q5BANmCedZCzni4332hZogZQBgQPr6LBHaNc4quHH_NHfkA0dKOTK61MrNq3T7hWYiU9EZWo7jHEU3LPHL-8TSOT_FCdaL2hHZcQ875r4ntTHKqsVKQWZHBqhnnK9DApE',
    status: 'Free',
    isBilingualAvailable: true,
    publishedYear: '2024',
    chaptersCount: 30,
    tags: ['Cozy Romance', 'Mombasa', 'Café Life', 'Second Chance'],
    chapters: [
      {
        id: 'coffee-ch1',
        number: 1,
        title: 'Cinnamon Brew',
        titleSwahili: 'Kahawa ya Mdalasini',
        releaseDate: '2024-10-01',
        wordCount: 1400,
        content: `The aroma of freshly ground Arabic cardamom beans filled Kahawa Bora Café as the morning sea breeze rustled the bougainvillea flowers.`,
        contentSwahili: `Harufu ya kahawa iliyosagwa mpya ya iliki ilijaza Duka la Kahawa Bora wakati upepo wa asubuhi wa bahari ulipotikisa maua ya bougainvillea.`
      }
    ]
  },
  {
    id: 'watcher-in-westlands',
    title: 'The Watcher in Westlands',
    titleSwahili: 'Mwangalizi wa Westlands',
    author: 'E. J. Albright',
    category: 'Thriller',
    rating: 9.2,
    heatMetric: 'New',
    description:
      'A high-stakes suspense thriller unfolding in the affluent suburbs of Nairobi when a mysterious cyber investigator stumbles on a corporate conspiracy.',
    descriptionSwahili:
      'Hadithi ya kusisimua ya spioni inayojitokeza katika mitaa ya kifahari ya Nairobi wakati mpelelezi wa mtandao anapogundua njama za makampuni makubwa.',
    coverImage:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDqjvk8XwgW_p_n-Q6-NKGnv-uUstZ2aBFxNel3juerCb85WJ7W9BALj4w9j3WbFQJID71O1BRTWxBvGuvYCJGj6LH6yP89R6_8k05hNcDLysaygviH9ydGebsVyHQ_PQNuMBxYjZOmOOStKmTKRxjdmFCIitOO7MYvgj94z2orVHLdDW1AqEvi6D3M3F4PT57pWPYVoO50JHBSAckG0-8D3rtio_nGfPnHW5TQuDJ5HDrSEIRKEm-xI919y606TariV7ow2Q7lC0',
    status: 'New',
    isBilingualAvailable: true,
    publishedYear: '2025',
    chaptersCount: 18,
    tags: ['Cyber Thriller', 'Nairobi Mystery', 'Corporate Crime'],
    chapters: [
      {
        id: 'watcher-ch1',
        number: 1,
        title: 'Behind Venetian Blinds',
        titleSwahili: 'Nyuma ya Mapazia ya Kioo',
        releaseDate: '2025-02-15',
        wordCount: 1650,
        content: `Through the half-closed Venetian blinds of the eighth-floor penthouse, James watched the rain sweep across the Westlands commercial park.`,
        contentSwahili: `Kupitia mapazia yaliyofungwa nusu ya ghorofa ya nane, James alitazama mvua ikipiga eneo la biashara la Westlands.`
      }
    ]
  },
  {
    id: 'wings-of-the-rift',
    title: 'Wings of the Rift',
    titleSwahili: 'Mawaa ya Bonde la Ufa',
    author: 'Eliza Reed',
    category: 'Fantasy',
    rating: 9.5,
    heatMetric: '210k',
    description:
      'An epic fantasy story of a mythical fiery phoenix bird soaring above the Great Rift Valley to unite elemental tribes against an ancient shadow.',
    descriptionSwahili:
      'Hadithi kuu ya njozi kuhusu ndege wa kizushi wa moto anayeruka juu ya Bonde Kuu la Ufa kuunganisha kabila dhidi ya kivuli cha kale.',
    coverImage:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBbDrdAch_pOy9VnEOZe_L0NiqS1BIHQ3rj1kO6mfzxVAvTLm7Ux24kCxK28Bn643N2ei9zbWmkoYNpMUG3uSsEGaJP4Wyq29_Zv1mVye8NmleiwdC0NLQidXlHtytQLG_6zmKNw5VMHQiNyd5Nq31CyB398U7-MdO0HYvYDzI9Cb7XSlrE_tI2obGHvfba6PY5RDr3mty9L0C7cHvcZXStC5jTKqJelVtabj_sBJLoXBnqEDA77HxDvP5sjK9Wz_U5U8YuyoU6mnY',
    status: 'Completed',
    isBilingualAvailable: true,
    publishedYear: '2024',
    chaptersCount: 88,
    tags: ['Epic Fantasy', 'Phoenix Myth', 'Rift Valley'],
    chapters: [
      {
        id: 'wings-ch1',
        number: 1,
        title: 'The Great Canopy',
        titleSwahili: 'Ganda Kuu la Miti',
        releaseDate: '2024-08-10',
        wordCount: 1800,
        content: `Golden rays filtered through the ancient forest canopy as a cry echoed across the escarpment—a sound that hadn't been heard in a thousand years.`,
        contentSwahili: `Miozi ya dhahabu ilipenya kupitia ganda la miti ya kale ya msitu wakati kilio kilipovuma kwenye ukingo wa mlima—sauti ambayo haikuwa imesikika kwa miaka elfu moja.`
      }
    ]
  },
  {
    id: 'voice-of-the-voiceless',
    title: 'Voice of the Voiceless',
    titleSwahili: 'Sauti ya Wasiokuwa na Sauti',
    author: 'Elara Vance',
    category: 'Contemporary',
    rating: 9.0,
    heatMetric: '180k',
    description:
      'A powerful contemporary novel following an outspoken late-night radio host speaking truth to power while navigating personal trial and redemption.',
    descriptionSwahili:
      'Riwanya yenye nguvu ya kisasa inayomfuata mtangazaji shujaa wa redio ya usiku anayezungumza ukweli huku akipambana na changamoto za kibinafsi.',
    coverImage:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAhGWqSM0z5gfoN-PLS7aF72Lhh5IkwN7F_GLtqAYoAH8XDEoOLYl4Brp21BjdhKNU_INFipJhV6Jd3_VCEImG5WUr-2kzksoKOslyN7C7DsbY98M1HUxguzMgnvl2jJ2nQurMzaeBQHjXIT3nVSjUTyDFtx-uUg3ioF3GHklRKt4A-GHHHUE5XoNGlIyN8sVS5C2KPiX8JVkvvsEDfz-RBWMue-GT1C893OvZAkuWUL57jG7dZS06GgGM6i-LAQxVQnS7Y5Lv3OZo',
    status: 'Completed',
    isBilingualAvailable: true,
    publishedYear: '2024',
    chaptersCount: 24,
    tags: ['Contemporary', 'Radio Drama', 'Social Justice'],
    chapters: [
      {
        id: 'voice-ch1',
        number: 1,
        title: 'On the Air at Midnight',
        titleSwahili: 'Hewani Saa Sita za Usiku',
        releaseDate: '2024-09-01',
        wordCount: 1450,
        content: `The red light glowed in the soundproof studio: ON AIR. Radio presenter Wanjiku cleared her throat, stepped closer to the condenser microphone, and began.`,
        contentSwahili: `Taa nyekundu iling'aa katika studio isiyoingiza sauti: ON AIR. Mtangazaji wa redio Wanjiku alisafisha koo lake, akasogea karibu na maikrofoni, na kuanza.`
      }
    ]
  }
];

export const QUICK_NAVIGATION_ITEMS = [
  {
    title: 'Popular',
    titleSwahili: 'Maarufu',
    iconUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCCv6OsFH_dxCoTZidhPrYlFmSpqgTlZPuiORia7bovdEW45OgQsjZgIheyd5khyzP29Q8P979mmg-_HrR8PIEWVfG7UYtOdvmL_-rPs07q4Mq5K_REGRQpgjoRrBEFBvs3PdB7LQQIn8lJddplrzDlublvKV1rQUXp9xRxOGEle7xvDJXrUH_tiK4iOdY5AJu_eE6VylDvXzkvmyQasacysev1emrcCbzVN1xaCM9T1uGQB7mOrBQ5W3RjzmLNaOugfsqNqds84rk',
    tabName: 'Popular' as const
  },
  {
    title: 'Just Added',
    titleSwahili: 'Vipya',
    iconUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuB_QWxRvTx5eCRGnlE8dDqUlDXGpqwtmkRDauF9rgIjwePCt1vV-jg5OtpLTkCMzUqQRyWurcGB7kHOP2cG5oSUxL1IOdbIb8fwIUGezSDY3Ln5i7X1ntprrGlI6iux6O7-KVIn6tyFlNkRqh80bCoz33yzyjoIWVJeWLfC40y6C5kTPVXYKxhtlpNR00o8AVJ5OF0N5kE2A1NEQ8Hc5IsMXsIwrZQ3GxdDFWk_UyX3g7o3zLM2RK8rkftSw4_uoTF9oqqrHpWu7W4',
    tabName: 'Home' as const
  },
  {
    title: 'Free Zone',
    titleSwahili: 'Eneo Huru',
    iconUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBElJHuv2T_PUdFs-yKcrWZe2DYSArNYimBSEEUG0tCzvlQ6CEGO1R8fzh8CJzAKLeZ1msjg2BMwpsUKOIPYI3Zq8Ksj49GSLIj74ZocJpYaCQeL2rpAiTmyhXGrMWwQyXKfeLMNMxcBiud41PawVqNXoj46va0oUobTkD_XtvWNAY3WrFbZQRNDth8coQj3Y2a3YxdrVrXIEbgxiA5GslNtyt2XSEuuhTE2K0gYN8mFgqal8tkeZIEwtcPxFDT2QYrgKj4tRqv-sw',
    tabName: 'Free Zone' as const
  },
  {
    title: 'Completed',
    titleSwahili: 'Yaliyokamilika',
    iconUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCtc0C33bQzfJZbCWJEA9DlSWkCg9kZt6r2B2uCJ-iFAZ6EpY6oNxbN3-gpuJcg6QhFfnDquW4i2NTFByGpmTDrO7RI1tZ0dXSwnmLVNYxoNjqRb4c3vXUQxVlJo2h4MbMFMvOu6NFNfgDUUfZ7uUWa7nZOmD--EvPEuhyOZDd_IZ3LvCmwnXQgFz8a1XqRDQZfgbyP0iCj9XOCyy6PUa_w2W27NYfY2TWzibbkLI9Evo0NjVrxk632PPkXba8i7p1521kFs1-JUZg',
    tabName: 'Completed' as const
  },
  {
    title: 'Bilingual',
    titleSwahili: 'Lugha Mbili',
    iconUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCyECv2IcvJ7d9DdHDSD5F9pXeu2h70rVzjnMY2o8yqI_4e_PV0VVue3T-7Ub2Cb5ceWXwYeqFsc203jPnYH-fid-tMCXNtElsAlrfjxo_aSs1M3q0v8tdEBh-zDdS0k-oS_OJsEpV2D5hnSkISWA33a2mhxjwFNy3kUIwsnmaODuleI3tl_TuMj3W9QRf6wGKRbg86yU86_3zAVt8SFkuzKOiZ8c0RTHfJHEc4Xq9avi8ZP4d-Hx-ZrmTr6yGfbln5HtYDb1Rc2mo',
    tabName: 'Bilingual' as const
  }
];
