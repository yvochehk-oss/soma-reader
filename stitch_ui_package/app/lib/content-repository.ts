export { type Book, type Chapter } from "@/app/lib/demo-data";
import { createClient, getPublicSupabaseEnv } from "@/app/lib/supabase/server";
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

export async function listPublishedBooks(language?: "en" | "sw"): Promise<Book[]> {
  if (!(await configured())) return language ? demoBooks.filter((book) => book.language === language) : demoBooks;
  try {
    const supabase = await createClient();
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
    const supabase = await createClient();
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
    const supabase = await createClient();
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
    const supabase = await createClient();
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

export async function findPublishedChapter(slug: string, chapterNumber: number): Promise<Chapter | undefined> {
  const list = await listPublishedChapters(slug);
  return list.find((chapter) => chapter.number === chapterNumber);
}
