export { type Book, type Chapter } from "@/app/lib/demo-data";
import { createPublicClient, getPublicSupabaseEnv } from "@/app/lib/supabase/server";
import {
  books as demoBooks,
  chapters as demoChapters,
  type Book,
  type Chapter,
} from "@/app/lib/demo-data";

type BookRow = {
  id: string;
  parent_book_id: string | null;
  slug: string;
  title: string;
  author_name: string;
  description: string;
  language_code: "en" | "sw";
  category: string;
  total_chapters: number;
  updated_at: string;
  is_featured: boolean;
  cover_url: string | null;
};

type ChapterRow = {
  id: string;
  chapter_number: number;
  title: string;
  content: string;
};

type ChapterSummaryRow = Pick<ChapterRow, "id" | "chapter_number" | "title">;

type ChapterNumberRow = { chapter_number: number };

export type ChapterSummary = Pick<Chapter, "id" | "number" | "title" | "summary">;

export type ChapterContent = {
  id?: string;
  number: number;
  title: string;
  content: string;
};

const categoryLabels: Record<string, string> = {
  romance: "Romance",
  thriller: "Thriller",
  life: "Maisha",
  youth: "Vijana",
  other: "Stories",
};

async function configured() {
  const { url, key } = await getPublicSupabaseEnv();
  return Boolean(url && key);
}

function accentFor(category: string, language: "en" | "sw"): Book["accent"] {
  if (category === "romance") return "orange";
  if (category === "thriller") return "purple";
  if (language === "sw") return "teal";
  return "green";
}

function relativeUpdated(value: string) {
  const ageHours = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 3_600_000));
  if (ageHours < 1) return "Just now";
  if (ageHours < 24) return `${ageHours}h ago`;
  if (ageHours < 48) return "Yesterday";
  return `${Math.round(ageHours / 24)}d ago`;
}

function mapBook(row: BookRow): Book {
  return {
    id: row.id,
    parentBookId: row.parent_book_id,
    slug: row.slug,
    title: row.title,
    author: row.author_name,
    description: row.description,
    language: row.language_code,
    languageLabel: row.language_code === "sw" ? "Kiswahili" : "English",
    category: row.category,
    categoryLabel: categoryLabels[row.category] ?? row.category,
    chapters: row.total_chapters,
    updated: relativeUpdated(row.updated_at),
    accent: accentFor(row.category, row.language_code),
    badge: row.is_featured ? "Featured" : undefined,
    coverUrl: row.cover_url,
  };
}

function mapChapter(row: ChapterRow): Chapter {
  const paragraphs = row.content.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  return {
    id: row.id,
    number: row.chapter_number,
    title: row.title,
    summary: paragraphs[0]?.split(/(?<=[.!?。！？])\s+/)[0] ?? "Continue the story.",
    paragraphs,
  };
}

function mapChapterSummary(row: ChapterSummaryRow): ChapterSummary {
  return {
    id: row.id,
    number: row.chapter_number,
    title: row.title,
    summary: "Tap to read this chapter.",
  };
}

async function publishedBookId(supabase: Awaited<ReturnType<typeof createPublicClient>>, slug: string) {
  const { data, error } = await supabase
    .from("books")
    .select("id")
    .eq("slug", slug)
    .eq("status", "published")
    .or("published_at.is.null,published_at.lte." + new Date().toISOString())
    .maybeSingle();
  return !error && data?.id ? String(data.id) : undefined;
}

export async function listPublishedBooks(language?: "en" | "sw"): Promise<Book[]> {
  if (!(await configured())) return language ? demoBooks.filter((book) => book.language === language) : demoBooks;
  try {
    const supabase = await createPublicClient();
    let query = supabase
      .from("books")
      .select("id,parent_book_id,slug,title,author_name,description,language_code,category,total_chapters,updated_at,is_featured,cover_url")
      .eq("status", "published")
      .or("published_at.is.null,published_at.lte." + new Date().toISOString())
      .order("is_featured", { ascending: false })
      .order("updated_at", { ascending: false });
    if (language) query = query.eq("language_code", language);
    const { data, error } = await query;
    if (error || !data?.length) return [];
    return (data as BookRow[]).map(mapBook);
  } catch {
    return demoBooks;
  }
}

export async function findPublishedBook(slug: string): Promise<Book | undefined> {
  if (!(await configured())) return demoBooks.find((book) => book.slug === slug);
  try {
    const supabase = await createPublicClient();
    const { data, error } = await supabase
      .from("books")
      .select("id,parent_book_id,slug,title,author_name,description,language_code,category,total_chapters,updated_at,is_featured,cover_url")
      .eq("slug", slug)
      .eq("status", "published")
      .or("published_at.is.null,published_at.lte." + new Date().toISOString())
      .maybeSingle();
    if (!error && data) return mapBook(data as BookRow);
  } catch {
    // Fall back to local content while configuration is being rolled out.
  }
  return undefined;
}

export async function listPublishedBookVersions(book: Book): Promise<Book[]> {
  if (!(await configured()) || !book.id) return [];
  try {
    const rootId = book.parentBookId ?? book.id;
    const supabase = await createPublicClient();
    const { data, error } = await supabase
      .from("books")
      .select("id,parent_book_id,slug,title,author_name,description,language_code,category,total_chapters,updated_at,is_featured,cover_url")
      .eq("status", "published")
      .or("published_at.is.null,published_at.lte." + new Date().toISOString())
      .or(`id.eq.${rootId},parent_book_id.eq.${rootId}`)
      .order("language_code", { ascending: true });
    if (!error && data) return (data as BookRow[]).map(mapBook);
  } catch {
    // A single-language book remains readable if version lookup is unavailable.
  }
  return [];
}

export async function listPublishedChapters(slug: string): Promise<Chapter[]> {
  if (!(await configured())) return demoChapters[slug] ?? [];
  try {
    const supabase = await createPublicClient();
    const { data: book } = await supabase.from("books").select("id").eq("slug", slug).eq("status", "published").or("published_at.is.null,published_at.lte." + new Date().toISOString()).maybeSingle();
    if (book) {
      const { data, error } = await supabase
        .from("chapters")
        .select("id,chapter_number,title,content")
        .eq("book_id", book.id)
        .eq("status", "published")
        .or("published_at.is.null,published_at.lte." + new Date().toISOString())
        .order("chapter_number", { ascending: true });
      if (!error && data?.length) return (data as ChapterRow[]).map(mapChapter);
    }
  } catch {
    // Fall back to local content while configuration is being rolled out.
  }
  return [];
}

export async function listPublishedChapterSummaries(slug: string, bookId?: string): Promise<ChapterSummary[]> {
  if (!(await configured())) {
    return (demoChapters[slug] ?? []).map(({ id, number, title, summary }) => ({ id, number, title, summary }));
  }
  try {
    const supabase = await createPublicClient();
    const id = bookId ?? await publishedBookId(supabase, slug);
    if (!id) return [];
    // Never fetch chapter bodies just to decorate the table of contents. A persisted excerpt
    // column can replace this small UI hint without changing the hot path.
    const { data, error } = await supabase
      .from("chapters")
      .select("id,chapter_number,title")
      .eq("book_id", id)
      .eq("status", "published")
      .or("published_at.is.null,published_at.lte." + new Date().toISOString())
      .order("chapter_number", { ascending: true });
    if (!error && data) return (data as ChapterSummaryRow[]).map(mapChapterSummary);
  } catch {
    // Fall back to local content while configuration is being rolled out.
  }
  return [];
}

export async function findPublishedChapter(slug: string, chapterNumber: number, bookId?: string): Promise<Chapter | undefined> {
  if (!(await configured())) return (demoChapters[slug] ?? []).find((chapter) => chapter.number === chapterNumber);
  try {
    const supabase = await createPublicClient();
    const id = bookId ?? await publishedBookId(supabase, slug);
    if (!id) return undefined;
    const { data, error } = await supabase
      .from("chapters")
      .select("id,chapter_number,title,content")
      .eq("book_id", id)
      .eq("chapter_number", chapterNumber)
      .eq("status", "published")
      .or("published_at.is.null,published_at.lte." + new Date().toISOString())
      .maybeSingle();
    if (!error && data) return mapChapter(data as ChapterRow);
  } catch {
    // Fall back to local content while configuration is being rolled out.
  }
  return undefined;
}

export async function findAdjacentChapterNumbers(
  slug: string,
  bookId: string | undefined,
  chapterNumber: number,
): Promise<{ previous?: number; next?: number }> {
  if (!(await configured())) {
    const chapters = (demoChapters[slug] ?? []).map((chapter) => chapter.number).sort((a, b) => a - b);
    return {
      previous: [...chapters].reverse().find((number) => number < chapterNumber),
      next: chapters.find((number) => number > chapterNumber),
    };
  }
  if (!bookId) return {};
  try {
    const supabase = await createPublicClient();
    const [previousResult, nextResult] = await Promise.all([
      supabase.from("chapters").select("chapter_number").eq("book_id", bookId).eq("status", "published")
        .or("published_at.is.null,published_at.lte." + new Date().toISOString()).lt("chapter_number", chapterNumber)
        .order("chapter_number", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("chapters").select("chapter_number").eq("book_id", bookId).eq("status", "published")
        .or("published_at.is.null,published_at.lte." + new Date().toISOString()).gt("chapter_number", chapterNumber)
        .order("chapter_number", { ascending: true }).limit(1).maybeSingle(),
    ]);
    return {
      previous: !previousResult.error ? (previousResult.data as ChapterNumberRow | null)?.chapter_number : undefined,
      next: !nextResult.error ? (nextResult.data as ChapterNumberRow | null)?.chapter_number : undefined,
    };
  } catch {
    return {};
  }
}

export async function listPublishedChapterWindow(
  slug: string,
  startNumber: number,
  limit: number,
  bookId?: string,
): Promise<ChapterContent[]> {
  const safeStart = Math.max(1, Math.floor(startNumber));
  const safeLimit = Math.max(1, Math.min(20, Math.floor(limit)));
  if (!(await configured())) {
    return (demoChapters[slug] ?? [])
      .filter((chapter) => chapter.number >= safeStart)
      .sort((a, b) => a.number - b.number)
      .slice(0, safeLimit)
      .map((chapter) => ({ id: chapter.id, number: chapter.number, title: chapter.title, content: chapter.paragraphs.join("\n\n") }));
  }
  try {
    const supabase = await createPublicClient();
    const id = bookId ?? await publishedBookId(supabase, slug);
    if (!id) return [];
    const { data, error } = await supabase
      .from("chapters")
      .select("id,chapter_number,title,content")
      .eq("book_id", id)
      .eq("status", "published")
      .or("published_at.is.null,published_at.lte." + new Date().toISOString())
      .gte("chapter_number", safeStart)
      .order("chapter_number", { ascending: true })
      .limit(safeLimit);
    if (!error && data) {
      return (data as ChapterRow[]).map((row) => ({ id: row.id, number: row.chapter_number, title: row.title, content: row.content }));
    }
  } catch {
    // Fall back to local content while configuration is being rolled out.
  }
  return [];
}
