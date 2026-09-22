import type { SupabaseClient } from "@supabase/supabase-js";

type BookRow = {
  id: string;
  parent_book_id: string | null;
  slug: string;
  title: string;
  author_name: string;
  language_code: "en" | "sw";
  category: string;
  description: string;
  cover_url: string | null;
  tags: unknown;
  status: "draft" | "published" | "hidden";
  total_chapters: number;
};

type ChapterRow = { book_id: string; chapter_number: number; status: "draft" | "published" };

export async function inspectBookRelease(supabase: SupabaseClient, slugs: string[]) {
  const { data, error } = await supabase
    .from("books")
    .select("id,parent_book_id,slug,title,author_name,language_code,category,description,cover_url,tags,status,total_chapters")
    .in("slug", slugs);
  if (error) throw new Error(error.message);
  const books = (data ?? []) as BookRow[];
  const bookIds = books.map((book) => book.id);
  const parentIds = [...new Set(books.map((book) => book.parent_book_id).filter((id): id is string => Boolean(id)))];
  const localSlugById = new Map(books.map((book) => [book.id, book.slug]));

  if (parentIds.some((id) => !localSlugById.has(id))) {
    const { data: parents, error: parentError } = await supabase.from("books").select("id,slug").in("id", parentIds);
    if (parentError) throw new Error(parentError.message);
    for (const parent of parents ?? []) localSlugById.set(parent.id, parent.slug);
  }

  const chapters: ChapterRow[] = [];
  if (bookIds.length) {
    const { data: chapterRows, error: chapterError } = await supabase
      .from("chapters")
      .select("book_id,chapter_number,status")
      .in("book_id", bookIds);
    if (chapterError) throw new Error(chapterError.message);
    chapters.push(...((chapterRows ?? []) as ChapterRow[]));
  }

  return books.map((book) => {
    const bookChapters = chapters.filter((chapter) => chapter.book_id === book.id);
    return {
      slug: book.slug,
      title: book.title,
      author: book.author_name,
      language: book.language_code,
      category: book.category,
      descriptionLength: book.description?.length ?? 0,
      coverUrl: book.cover_url,
      tags: Array.isArray(book.tags) ? book.tags.filter((tag): tag is string => typeof tag === "string") : [],
      status: book.status,
      totalChapters: book.total_chapters,
      actualChapters: bookChapters.length,
      publishedChapters: bookChapters.filter((chapter) => chapter.status === "published").length,
      parentSlug: book.parent_book_id ? localSlugById.get(book.parent_book_id) ?? null : null,
    };
  });
}
