export type LanguageCode = "en" | "sw";

export type Book = {
  id?: string;
  parentBookId?: string | null;
  slug: string;
  title: string;
  author: string;
  description: string;
  language: LanguageCode;
  languageLabel: string;
  category: string;
  categoryLabel: string;
  chapters: number;
  updated: string;
  accent: "orange" | "teal" | "purple" | "green";
  badge?: string;
  coverUrl?: string | null;
};

export type Chapter = {
  id?: string;
  number: number;
  title: string;
  summary: string;
  paragraphs: string[];
};

export const books: Book[] = [
  {
    slug: "love-in-nairobi",
    title: "Love in Nairobi",
    author: "Amina K.",
    description:
      "When a young designer returns to Nairobi to rebuild her family’s business, she finds a new city, an old promise, and a love she never planned for.",
    language: "en",
    languageLabel: "English",
    category: "romance",
    categoryLabel: "Romance",
    chapters: 24,
    updated: "2h ago",
    accent: "orange",
    badge: "Trending",
  },
  {
    slug: "moyo-wa-jiji",
    title: "Moyo wa Jiji",
    author: "Neema Otieno",
    description:
      "Katika moyo wa Nairobi, Neema anapigania ndoto yake bila kusahau nguvu ya familia, urafiki na upendo wa kweli.",
    language: "sw",
    languageLabel: "Kiswahili",
    category: "life",
    categoryLabel: "Maisha",
    chapters: 18,
    updated: "5h ago",
    accent: "teal",
    badge: "Kiswahili",
  },
  {
    slug: "the-last-matatu",
    title: "The Last Matatu",
    author: "Brian Mwangi",
    description:
      "A night route across the city becomes a race against time when one passenger carries a secret that could change everything.",
    language: "en",
    languageLabel: "English",
    category: "thriller",
    categoryLabel: "Thriller",
    chapters: 31,
    updated: "Yesterday",
    accent: "purple",
    badge: "New",
  },
  {
    slug: "sauti-ya-nyota",
    title: "Sauti ya Nyota",
    author: "Zawadi M.",
    description:
      "A young singer from Mombasa discovers that the voice she has been hiding may be the key to her future.",
    language: "sw",
    languageLabel: "Kiswahili",
    category: "youth",
    categoryLabel: "Vijana",
    chapters: 12,
    updated: "2d ago",
    accent: "green",
  },
];

export const chapters: Record<string, Chapter[]> = {
  "love-in-nairobi": [
    {
      number: 1,
      title: "The City That Waited",
      summary: "Amina comes home with one suitcase and a plan.",
      paragraphs: [
        "The first thing Amina noticed about Nairobi was the light. It spilled between the apartment blocks in long, golden lines, turning every dusty window into a small promise.",
        "She held her suitcase with one hand and her father’s old key with the other. Three years away had made the key feel heavier than it should. The shop on Biashara Street was still there. So was the question she had left behind.",
        "A matatu hooted at the corner. Someone laughed near the fruit stand. Nairobi had not waited quietly for her, but it had saved a place for her in its noise.",
        "‘You came back,’ a voice said behind her.",
        "Amina turned. She knew that voice before she saw the face. And suddenly, the plan she had rehearsed on the flight home no longer felt like enough.",
      ],
    },
    {
      number: 2,
      title: "A Familiar Face",
      summary: "The past walks into the family shop.",
      paragraphs: [
        "The bell above the shop door had not changed. It still rang twice, with a small pause between the notes, as if it needed time to remember everyone who entered.",
        "Amina placed the old key on the counter. Across the street, the city moved in bright, impatient waves. She could hear the promise of rain above the traffic.",
        "Then Daniel stepped inside, carrying two cups of chai and the same easy smile he had worn at nineteen.",
        "‘I thought you might need a welcome home,’ he said.",
      ],
    },
    {
      number: 3,
      title: "The New Sign",
      summary: "A bold idea changes the shop window.",
      paragraphs: [
        "By Saturday morning, the old sign was down. Amina stood on a wooden ladder while Daniel held the paint tin below.",
        "‘You know,’ he called, ‘most people start with a business plan.’",
        "‘Most people do not have three years of ideas waiting in a suitcase.’",
        "The new sign caught the morning sun. For the first time since she came home, Amina felt the city answer back.",
      ],
    },
  ],
  "moyo-wa-jiji": [
    {
      number: 1,
      title: "Asubuhi Nairobi",
      summary: "Neema anaianza siku kwa uamuzi mpya.",
      paragraphs: [
        "Nairobi iliamka kabla ya jua. Sauti za magari, wauzaji wa chai na hatua za watu zilijaza barabara kama wimbo wa kila siku.",
        "Neema alifunga daftari lake na kuangalia ujumbe uliokuwa kwenye simu. Leo angeenda kwenye mahojiano ya kazi aliyokuwa akiingojea kwa muda mrefu.",
        "Alijua safari haitakuwa rahisi, lakini kila ndoto kubwa huanza na hatua ndogo.",
      ],
    },
  ],
  "the-last-matatu": [
    {
      number: 1,
      title: "Route 44",
      summary: "The last ride of the night carries an unexpected passenger.",
      paragraphs: [
        "At 11:47 p.m., the city changed its face. The shops pulled down their shutters, the sidewalks emptied, and Route 44 became the only moving light on the road.",
        "Sam knew every turn between Westlands and the station. He did not know the woman who climbed in with a red envelope pressed against her coat.",
        "‘Keep driving,’ she whispered. ‘They are already looking for me.’",
      ],
    },
  ],
  "sauti-ya-nyota": [
    {
      number: 1,
      title: "Wimbo wa Kwanza",
      summary: "Zawadi anapata ujasiri wa kuimba mbele ya watu.",
      paragraphs: [
        "Zawadi aliimba kwa sauti ya chini kila alipokuwa peke yake. Lakini usiku huo, taa za jukwaa zilimwita kwa jina.",
        "Alivuta pumzi ndefu, akamwangalia mama yake kwenye umati, kisha akaanza wimbo wa kwanza.",
      ],
    },
  ],
};

export function getBook(slug: string) {
  return books.find((book) => book.slug === slug);
}

export function getChapters(slug: string) {
  return chapters[slug] ?? [];
}

export function getChapter(slug: string, chapterNumber: number) {
  return getChapters(slug).find((chapter) => chapter.number === chapterNumber);
}
