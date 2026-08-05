import type { Book, Chapter, Language } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://uamaohjbrjervzsjxwyg.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_bLhT1CNl-DrFn_wz6gmp6A_fJPGBY2G';
const FALLBACK_COVER = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=800&auto=format&fit=crop';

type BookRow = {
  id: string;
  parent_book_id: string | null;
  slug: string;
  title: string;
  author_name: string;
  description: string;
  cover_url: string | null;
  language_code: Language;
  category: string;
  tags: string[] | null;
  total_chapters: number;
  is_featured: boolean;
  published_at: string | null;
  created_at: string;
};

type ChapterRow = {
  id: string;
  chapter_number: number;
  title: string;
  content: string;
  word_count: number;
  published_at: string | null;
};

function headers() {
  return { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}` };
}

function titleCase(value: string) {
  return value.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: headers() });
  if (!response.ok) throw new Error(`Supabase request failed (${response.status}).`);
  return response.json() as Promise<T>;
}

export async function fetchLiveBooksFromSupabase(): Promise<Book[]> {
  const now = new Date().toISOString();
  const query = new URLSearchParams({
    select: 'id,parent_book_id,slug,title,author_name,description,cover_url,language_code,category,tags,total_chapters,is_featured,published_at,created_at',
    status: 'eq.published',
    or: `(published_at.is.null,published_at.lte.${now})`,
    order: 'is_featured.desc,created_at.desc',
  });
  const rows = await readJson<BookRow[]>(`${SUPABASE_URL}/rest/v1/books?${query}`);
  const pairedIds = new Set(rows.flatMap((row) => [row.parent_book_id, rows.some((candidate) => candidate.parent_book_id === row.id) ? row.id : null]).filter(Boolean));

  return rows.map((row, index) => {
    const tags = row.tags ?? [];
    const isBilingualAvailable = pairedIds.has(row.id) || Boolean(row.parent_book_id);
    const status: Book['status'] = tags.some((tag) => tag.toLowerCase() === 'completed')
      ? 'Completed'
      : isBilingualAvailable
        ? 'Bilingual'
        : row.is_featured
          ? 'Hot'
          : 'Free';
    return {
      id: row.slug,
      databaseId: row.id,
      parentBookId: row.parent_book_id,
      language: row.language_code,
      title: row.title,
      author: row.author_name || 'Soma Originals',
      category: titleCase(row.category || 'other'),
      rating: 9.8,
      heatMetric: row.is_featured ? 'Featured' : `${row.total_chapters} chapters`,
      description: row.description || 'A story available on Soma.',
      coverImage: row.cover_url || FALLBACK_COVER,
      rank: index + 1,
      status,
      isEditorChoice: row.is_featured,
      isBilingualAvailable,
      chaptersCount: row.total_chapters,
      chapters: [],
      publishedYear: String(new Date(row.published_at || row.created_at).getFullYear()),
      tags,
    };
  });
}

export function selectLocalizedBooks(books: Book[], language: Language): Book[] {
  const byDatabaseId = new Map(books.map((book) => [book.databaseId, book]));
  const groups = new Map<string, Book[]>();

  for (const book of books) {
    const rootId = book.parentBookId ?? book.databaseId ?? book.id;
    groups.set(rootId, [...(groups.get(rootId) ?? []), book]);
  }

  return [...groups.values()]
    .map((versions) => {
      const english = versions.find((book) => book.language === 'en');
      const swahili = versions.find((book) => book.language === 'sw');
      const selected = versions.find((book) => book.language === language) ?? english ?? swahili ?? versions[0];
      const root = selected.parentBookId ? byDatabaseId.get(selected.parentBookId) : selected;
      const availableLanguages = new Set(versions.map((book) => book.language).filter(Boolean));

      return {
        ...selected,
        title: english?.title ?? root?.title ?? selected.title,
        titleSwahili: swahili?.title,
        description: english?.description ?? root?.description ?? selected.description,
        descriptionSwahili: swahili?.description,
        rank: Math.min(...versions.map((book) => book.rank ?? Number.MAX_SAFE_INTEGER)),
        status: availableLanguages.size > 1 ? 'Bilingual' as const : selected.status,
        isBilingualAvailable: availableLanguages.size > 1,
      };
    })
    .sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER));
}

export async function fetchBookChaptersFromSupabase(book: Book): Promise<Chapter[]> {
  if (!book.databaseId) throw new Error(`Missing database ID for ${book.title}.`);
  const now = new Date().toISOString();
  const query = new URLSearchParams({
    select: 'id,chapter_number,title,content,word_count,published_at',
    book_id: `eq.${book.databaseId}`,
    status: 'eq.published',
    or: `(published_at.is.null,published_at.lte.${now})`,
    order: 'chapter_number.asc',
  });
  const rows = await readJson<ChapterRow[]>(`${SUPABASE_URL}/rest/v1/chapters?${query}`);
  return rows.map((row) => ({
    id: row.id,
    number: row.chapter_number,
    title: row.title,
    content: row.content,
    wordCount: row.word_count || row.content.trim().split(/\s+/).filter(Boolean).length,
    releaseDate: row.published_at?.slice(0, 10) || '',
  }));
}
