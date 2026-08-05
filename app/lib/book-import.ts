import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_BOOKS = 20;
const MAX_CHAPTERS_PER_BOOK = 100;
const MAX_CHAPTERS = 1000;

type ChapterInput = { number?: unknown; title?: unknown; content?: unknown; status?: unknown; isFree?: unknown };
type BookInput = { slug?: unknown; title?: unknown; author?: unknown; language?: unknown; category?: unknown; description?: unknown; coverUrl?: unknown; coverDataUrl?: unknown; tags?: unknown; status?: unknown; featured?: unknown; translationOfSlug?: unknown; chapters?: ChapterInput[] };
type NormalizedBook = { slug: string; title: string; author: string; language: "en" | "sw"; category: string; description: string; coverUrl: string | null; coverDataUrl: string | null; tags: string[]; status: "draft" | "published" | "hidden"; featured: boolean; translationOfSlug: string | null; chapters: Array<{ number: number; title: string; content: string; status: "draft" | "published"; isFree: boolean }> };

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }
function wordCount(content: string) { return content.trim().split(/\s+/).filter(Boolean).length; }

function decodeCover(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match || match[2].length > 7_000_000) return null;
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { contentType: match[1], bytes };
}

function normalizeBook(input: BookInput, index: number): NormalizedBook | { error: string } {
  const title = text(input.title); const author = text(input.author); const slug = slugify(text(input.slug) || title);
  const language = input.language === "sw" ? "sw" : input.language === "en" ? "en" : null;
  const status = input.status === "published" || input.status === "hidden" || input.status === "draft" ? input.status : "draft";
  const chapters = Array.isArray(input.chapters) ? input.chapters : []; const coverDataUrl = text(input.coverDataUrl) || null;
  if (!title || !author || !slug || !language) return { error: `Book ${index + 1} needs title, author, and language (en or sw).` };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return { error: `Book ${index + 1} has an invalid slug.` };
  if (coverDataUrl && !decodeCover(coverDataUrl)) return { error: `Book ${index + 1} has an invalid cover image. Use a JPG, PNG or WebP image below 5 MB.` };
  const coverUrl = text(input.coverUrl) || null;
  if (coverUrl && !/^https:\/\//i.test(coverUrl) && !coverUrl.startsWith('/covers/')) return { error: `Book ${index + 1} has an invalid cover URL.` };
  if (status === "published" && !coverDataUrl && !coverUrl) return { error: `Published book ${index + 1} needs a cover image.` };
  if (status === "published" && !text(input.description)) return { error: `Published book ${index + 1} needs a description.` };
  if (!chapters.length || chapters.length > MAX_CHAPTERS_PER_BOOK) return { error: `Book ${index + 1} must include between 1 and ${MAX_CHAPTERS_PER_BOOK} chapters.` };
  const normalizedChapters: NormalizedBook["chapters"] = []; const chapterNumbers = new Set<number>();
  for (const chapter of chapters) {
    const number = Number(chapter.number); const chapterTitle = text(chapter.title); const content = text(chapter.content);
    if (!Number.isInteger(number) || number < 1 || chapterNumbers.has(number) || !chapterTitle || !content) return { error: `Book ${index + 1} has a chapter with a missing title/content or duplicate number.` };
    chapterNumbers.add(number); normalizedChapters.push({ number, title: chapterTitle, content, status: chapter.status === "published" ? "published" : "draft", isFree: chapter.isFree !== false });
  }
  const translationOfSlug = slugify(text(input.translationOfSlug));
  if (translationOfSlug === slug) return { error: `Book ${index + 1} cannot be a translation of itself.` };
  return { slug, title, author, language, category: text(input.category) || "other", description: text(input.description), coverUrl, coverDataUrl, tags: Array.isArray(input.tags) ? input.tags.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean) : [], status, featured: input.featured === true, translationOfSlug: translationOfSlug || null, chapters: normalizedChapters };
}

export async function importBooks(supabase: SupabaseClient, payload: { books?: BookInput[] }) {
  if (!Array.isArray(payload.books) || !payload.books.length || payload.books.length > MAX_BOOKS) throw new Error(`Provide between 1 and ${MAX_BOOKS} books.`);
  const books: NormalizedBook[] = [];
  for (const [index, input] of payload.books.entries()) { const book = normalizeBook(input, index); if ("error" in book) throw new Error(book.error); books.push(book); }
  if (new Set(books.map((book) => book.slug)).size !== books.length) throw new Error("Each book needs a unique slug.");
  if (books.reduce((total, book) => total + book.chapters.length, 0) > MAX_CHAPTERS) throw new Error(`A batch can contain at most ${MAX_CHAPTERS} chapters.`);
  const now = new Date().toISOString(); const coversBySlug = new Map<string, string>();
  const translatedSlugs = [...new Set(books.map((book) => book.translationOfSlug).filter((slug): slug is string => Boolean(slug)))];
  const externalParentSlugs = translatedSlugs.filter((slug) => !books.some((book) => book.slug === slug));
  const { data: existingParents, error: parentError } = externalParentSlugs.length ? await supabase.from("books").select("id,slug,language_code").in("slug", externalParentSlugs) : { data: [], error: null };
  if (parentError) throw new Error(parentError.message);
  const parentsBySlug = new Map((existingParents ?? []).map((parent: { id: string; slug: string; language_code: "en" | "sw" }) => [parent.slug, parent]));
  if (externalParentSlugs.some((slug) => !parentsBySlug.has(slug))) throw new Error("A translationOfSlug does not match an existing original book.");
  for (const book of books) {
    if (!book.translationOfSlug) continue;
    const parent = books.find((candidate) => candidate.slug === book.translationOfSlug) ?? parentsBySlug.get(book.translationOfSlug);
    if (parent && "translationOfSlug" in parent && parent.translationOfSlug) throw new Error(`A translation must point to an original work (${book.title}).`);
  }
  for (const book of books) {
    if (!book.coverDataUrl) continue;
    const cover = decodeCover(book.coverDataUrl); if (!cover) throw new Error(`Could not read cover for ${book.title}.`);
    const extension = cover.contentType === "image/png" ? "png" : cover.contentType === "image/webp" ? "webp" : "jpg";
    const path = `imports/${book.slug}/cover.${extension}`;
    const { error } = await supabase.storage.from("covers").upload(path, cover.bytes, { upsert: true, contentType: cover.contentType, cacheControl: "31536000" });
    if (error) throw new Error(`Could not upload cover for ${book.title}: ${error.message}`);
    const { data } = supabase.storage.from("covers").getPublicUrl(path); coversBySlug.set(book.slug, data.publicUrl);
  }
  // Stage every imported book as a draft so an interrupted multi-request import never exposes
  // a book with only some of its new chapters.
  const { data: savedBooks, error: bookError } = await supabase.from("books").upsert(books.map((book) => ({ slug: book.slug, title: book.title, author_name: book.author, language_code: book.language, category: book.category, description: book.description, cover_url: coversBySlug.get(book.slug) ?? book.coverUrl, tags: book.tags, status: "draft", is_featured: book.featured, published_at: null, total_chapters: book.chapters.length, parent_book_id: null })), { onConflict: "slug" }).select("id,slug,title");
  if (bookError || !savedBooks) throw new Error(bookError?.message ?? "Could not save books.");
  const idsBySlug = new Map(savedBooks.map((book: { slug: string; id: string }) => [book.slug, book.id]));
  const languageBySlug = new Map(books.map((book) => [book.slug, book.language]));
  for (const book of books) {
    if (!book.translationOfSlug) continue;
    const parentId = idsBySlug.get(book.translationOfSlug) ?? parentsBySlug.get(book.translationOfSlug)?.id;
    const parentLanguage = languageBySlug.get(book.translationOfSlug) ?? parentsBySlug.get(book.translationOfSlug)?.language_code;
    if (!parentId || !parentLanguage) throw new Error(`Could not resolve original work for ${book.title}.`);
    if (parentLanguage === book.language) throw new Error(`A translation must use a different language than its original work (${book.title}).`);
    const { error } = await supabase.from("books").update({ parent_book_id: parentId }).eq("id", idsBySlug.get(book.slug));
    if (error) throw new Error(error.message);
  }
  const chapterRows = books.flatMap((book) => book.chapters.map((chapter) => ({ book_id: idsBySlug.get(book.slug), chapter_number: chapter.number, title: chapter.title, content: chapter.content, status: chapter.status, is_free: chapter.isFree, published_at: chapter.status === "published" ? now : null, word_count: wordCount(chapter.content) })));
  if (chapterRows.some((chapter) => !chapter.book_id)) throw new Error("Could not match imported books.");
  const { error: chapterError } = await supabase.from("chapters").upsert(chapterRows, { onConflict: "book_id,chapter_number" });
  if (chapterError) throw new Error(chapterError.message);
  for (const book of books) {
    const bookId = idsBySlug.get(book.slug);
    const chapterNumbers = book.chapters.map((chapter) => chapter.number).join(",");
    const { error } = await supabase.from("chapters").delete().eq("book_id", bookId).not("chapter_number", "in", `(${chapterNumbers})`);
    if (error) throw new Error(`Could not remove stale chapters for ${book.title}: ${error.message}`);
    const { error: publishError } = await supabase.from("books").update({ status: book.status, published_at: book.status === "published" ? now : null, total_chapters: book.chapters.length }).eq("id", bookId);
    if (publishError) throw new Error(`Could not finalize ${book.title}: ${publishError.message}`);
  }
  return { ok: true, importedBooks: savedBooks.length, importedChapters: chapterRows.length, books: savedBooks };
}
