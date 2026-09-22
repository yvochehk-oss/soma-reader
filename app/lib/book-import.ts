import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_BOOKS = 20;
// Classic editions include long works such as Leviathan (700+ sections). Keep
// the guard high enough for a single validated book while retaining a bounded
// request size for the internal importer.
const MAX_CHAPTERS_PER_BOOK = 800;
const MAX_CHAPTERS = 1000;
const SOMA_CATEGORIES = new Set(["Romance", "Thriller", "Sci-Fi", "Historical", "Fantasy", "Contemporary", "Urban Fantasy"]);

type ChapterInput = { number?: unknown; title?: unknown; content?: unknown; status?: unknown; isFree?: unknown };
export type ClassicIntegrityInput = {
  verified?: unknown;
  sourceCanonicalSha256?: unknown;
  reconstructedCanonicalSha256?: unknown;
  sourceWordCount?: unknown;
  reconstructedWordCount?: unknown;
  coverageRatio?: unknown;
  minChapterWordCount?: unknown;
  maxChapterWordCount?: unknown;
  suspiciousShortChapterCount?: unknown;
  sourceStartFingerprint?: unknown;
  sourceEndFingerprint?: unknown;
  reconstructedStartFingerprint?: unknown;
  reconstructedEndFingerprint?: unknown;
};
type BookInput = { slug?: unknown; title?: unknown; author?: unknown; language?: unknown; category?: unknown; description?: unknown; coverUrl?: unknown; coverDataUrl?: unknown; tags?: unknown; status?: unknown; featured?: unknown; translationOfSlug?: unknown; integrity?: ClassicIntegrityInput; chapters?: ChapterInput[] };
type NormalizedBook = { slug: string; title: string; author: string; language: "en" | "sw"; category: string; description: string; coverUrl: string | null; coverDataUrl: string | null; tags: string[]; status: "draft" | "published" | "hidden"; featured: boolean; translationOfSlug: string | null; chapters: Array<{ number: number; title: string; content: string; status: "draft" | "published"; isFree: boolean }> };

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }
function wordCount(content: string) { return content.trim().split(/\s+/).filter(Boolean).length; }

const CLASSICS_TAG = "english classics";
const MAX_CLASSIC_CHAPTER_WORDS = 50_000;
const SHORT_CHAPTER_WORDS = 100;

type IntegrityChapter = { title: string; content: string };

function isSuspiciousShortChapter(chapter: IntegrityChapter) {
  if (wordCount(chapter.content) >= SHORT_CHAPTER_WORDS) return false;
  const title = chapter.title.trim().toLowerCase().replace(/[.:]+$/, "");
  if (/^(?:contents?|table of contents|index|navigation)$/.test(title)) return true;

  // A genuinely short chapter or pivotal one-line beat is valid. Only reject a
  // short section when both its heading and body look like TOC/page navigation.
  const markerTitle = /^(?:chapter\s+)?(?:\d+|[ivxlcdm]+|[-\u2013\u2014\s]+(?:\d+|[ivxlcdm]+)[-\u2013\u2014\s]*)$/i.test(title);
  const compactContent = chapter.content.replace(/\s+/g, " ").trim();
  const bracketedPageList = /^(?:\[\s*(?:\d+|[ivxlcdm]+)\s*\]\s*)+$/i.test(compactContent);
  const plainPageList = /^(?:(?:page\s*)?(?:\d+|[ivxlcdm]+)[,;|\s]*)+$/i.test(compactContent);
  return markerTitle && (bracketedPageList || plainPageList);
}

function positiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

/**
 * Validate the lossless-import evidence supplied for an English classic.
 * Other books intentionally bypass this structural gate: short modern-fiction
 * chapters (including a one-word dialogue beat) remain valid.
 */
export function validateClassicIntegrity(input: {
  title: string;
  tags: string[];
  chapters: IntegrityChapter[];
  integrity?: ClassicIntegrityInput;
}): string | null {
  if (!input.tags.some((tag) => tag.trim().toLowerCase() === CLASSICS_TAG)) return null;
  const integrity = input.integrity;
  if (!integrity || typeof integrity !== "object") return "must include integrity metadata for an English Classic.";
  if (integrity.verified !== true) return "must have verified integrity metadata.";

  const sourceSha = text(integrity.sourceCanonicalSha256).toLowerCase();
  const reconstructedSha = text(integrity.reconstructedCanonicalSha256).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(sourceSha) || !/^[a-f0-9]{64}$/.test(reconstructedSha) || sourceSha !== reconstructedSha) {
    return "failed its canonical SHA-256 preservation check.";
  }

  if (!positiveInteger(integrity.sourceWordCount) || !positiveInteger(integrity.reconstructedWordCount)) {
    return "must include positive source and reconstructed word counts.";
  }
  if (integrity.sourceWordCount !== integrity.reconstructedWordCount || integrity.coverageRatio !== 1) {
    return "must preserve 100% of the source words (coverageRatio must equal 1).";
  }

  const chapterWordCounts = input.chapters.map((chapter) => wordCount(chapter.content));
  const reconstructedWordCount = chapterWordCounts.reduce((sum, count) => sum + count, 0);
  const minChapterWordCount = Math.min(...chapterWordCounts);
  const maxChapterWordCount = Math.max(...chapterWordCounts);
  const suspiciousShortChapterCount = input.chapters.filter(isSuspiciousShortChapter).length;
  if (integrity.reconstructedWordCount !== reconstructedWordCount) {
    return "has reconstructedWordCount metadata that does not match the submitted chapters.";
  }
  if (integrity.minChapterWordCount !== minChapterWordCount || integrity.maxChapterWordCount !== maxChapterWordCount) {
    return "has chapter word-count metadata that does not match the submitted chapters.";
  }
  if (integrity.suspiciousShortChapterCount !== suspiciousShortChapterCount) {
    return "has suspicious-short-chapter metadata that does not match the submitted chapters.";
  }
  if (suspiciousShortChapterCount !== 0) return "contains a suspicious short table-of-contents or page-navigation chapter.";
  if (maxChapterWordCount > MAX_CLASSIC_CHAPTER_WORDS) return `contains a chapter longer than ${MAX_CLASSIC_CHAPTER_WORDS.toLocaleString("en-US")} words.`;

  const sourceStart = text(integrity.sourceStartFingerprint);
  const sourceEnd = text(integrity.sourceEndFingerprint);
  const reconstructedStart = text(integrity.reconstructedStartFingerprint);
  const reconstructedEnd = text(integrity.reconstructedEndFingerprint);
  if (!sourceStart || !sourceEnd || sourceStart !== reconstructedStart || sourceEnd !== reconstructedEnd) {
    return "failed its source start/end fingerprint check.";
  }
  return null;
}

function decodeCover(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match || match[2].length > 7_000_000) return null;
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { contentType: match[1], bytes };
}

function normalizeBook(input: BookInput, index: number, options: { chaptersOnly?: boolean; deferClassicIntegrity?: boolean } = {}): NormalizedBook | { error: string } {
  const title = text(input.title); const author = text(input.author); const slug = slugify(text(input.slug) || title);
  const language = input.language === "sw" ? "sw" : input.language === "en" ? "en" : null;
  const status = input.status === "published" || input.status === "hidden" || input.status === "draft" ? input.status : "draft";
  const chapters = Array.isArray(input.chapters) ? input.chapters : []; const coverDataUrl = text(input.coverDataUrl) || null;
  if (!title || !author || !slug || !language) return { error: `Book ${index + 1} needs title, author, and language (en or sw).` };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return { error: `Book ${index + 1} has an invalid slug.` };
  if (!options.chaptersOnly && coverDataUrl && !decodeCover(coverDataUrl)) return { error: `Book ${index + 1} has an invalid cover image. Use a JPG, PNG or WebP image below 5 MB.` };
  const coverUrl = text(input.coverUrl) || null;
  if (!options.chaptersOnly && coverUrl && !/^https:\/\//i.test(coverUrl) && !coverUrl.startsWith('/covers/')) return { error: `Book ${index + 1} has an invalid cover URL.` };
  if (!options.chaptersOnly && status === "published" && !coverDataUrl && !coverUrl) return { error: `Published book ${index + 1} needs a cover image.` };
  if (!options.chaptersOnly && status === "published" && !text(input.description)) return { error: `Published book ${index + 1} needs a description.` };
  if (!chapters.length || chapters.length > MAX_CHAPTERS_PER_BOOK) return { error: `Book ${index + 1} must include between 1 and ${MAX_CHAPTERS_PER_BOOK} chapters.` };
  const normalizedChapters: NormalizedBook["chapters"] = []; const chapterNumbers = new Set<number>();
  for (const chapter of chapters) {
    const number = Number(chapter.number); const chapterTitle = text(chapter.title); const content = text(chapter.content);
    if (!Number.isInteger(number) || number < 1 || chapterNumbers.has(number) || !chapterTitle || !content) return { error: `Book ${index + 1} has a chapter with a missing title/content or duplicate number.` };
    chapterNumbers.add(number); normalizedChapters.push({ number, title: chapterTitle, content, status: chapter.status === "published" ? "published" : "draft", isFree: chapter.isFree !== false });
  }
  const normalizedTags = Array.isArray(input.tags)
    ? input.tags.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim().replace(/\s+/g, " ")).filter(Boolean)
    : [];
  const uniqueTags = new Map<string, string>();
  for (const tag of normalizedTags) if (!uniqueTags.has(tag.toLowerCase())) uniqueTags.set(tag.toLowerCase(), tag);
  const tags = [...uniqueTags.values()];
  const category = text(input.category) || "Other";
  if (!options.chaptersOnly && status === "published" && !SOMA_CATEGORIES.has(category)) {
    return { error: `Published book ${index + 1} needs a canonical category.` };
  }
  if (!options.chaptersOnly && status === "published" && !tags.length) return { error: `Published book ${index + 1} needs at least one tag.` };
  if (tags.length > 12 || tags.some((tag) => tag.length > 40)) return { error: `Book ${index + 1} has too many tags or a tag longer than 40 characters.` };
  if (!options.deferClassicIntegrity) {
    const integrityError = validateClassicIntegrity({ title, tags, chapters: normalizedChapters, integrity: input.integrity });
    if (integrityError) return { error: `Book ${index + 1} (${title}) ${integrityError}` };
  }
  const translationOfSlug = slugify(text(input.translationOfSlug));
  if (translationOfSlug === slug) return { error: `Book ${index + 1} cannot be a translation of itself.` };
  return { slug, title, author, language, category, description: text(input.description), coverUrl, coverDataUrl, tags, status, featured: input.featured === true, translationOfSlug: translationOfSlug || null, chapters: normalizedChapters };
}

type ExistingBookForChapterUpdate = {
  id: string;
  slug: string;
  title: string;
  tags: unknown;
};

async function importChaptersOnly(supabase: SupabaseClient, books: NormalizedBook[], inputs: BookInput[]) {
  const slugs = books.map((book) => book.slug);
  const { data, error: lookupError } = await supabase.from("books").select("id,slug,title,tags").in("slug", slugs);
  if (lookupError) throw new Error(lookupError.message);
  const existingBooks = (data ?? []) as ExistingBookForChapterUpdate[];
  const existingBySlug = new Map(existingBooks.map((book) => [book.slug, book]));
  const missingSlugs = slugs.filter((slug) => !existingBySlug.has(slug));
  if (missingSlugs.length) throw new Error(`chapters-only can update existing books only. Missing slug: ${missingSlugs.join(", ")}.`);

  for (const [index, book] of books.entries()) {
    const existing = existingBySlug.get(book.slug)!;
    const existingTags = Array.isArray(existing.tags) ? existing.tags.filter((tag): tag is string => typeof tag === "string") : [];
    const integrityError = validateClassicIntegrity({ title: existing.title || book.title, tags: existingTags, chapters: book.chapters, integrity: inputs[index].integrity });
    if (integrityError) throw new Error(`Book ${index + 1} (${existing.title || book.title}) ${integrityError}`);
  }

  const now = new Date().toISOString();
  const chapterRows = books.flatMap((book) => book.chapters.map((chapter) => ({ book_id: existingBySlug.get(book.slug)!.id, chapter_number: chapter.number, title: chapter.title, content: chapter.content, status: chapter.status, is_free: chapter.isFree, published_at: chapter.status === "published" ? now : null, word_count: wordCount(chapter.content) })));
  // The multi-row upsert is one database statement. Do it before removing stale
  // rows so an interrupted request leaves either the old edition or the full new
  // edition plus harmless extras; every step is idempotent and safe to retry.
  const { error: chapterError } = await supabase.from("chapters").upsert(chapterRows, { onConflict: "book_id,chapter_number" });
  if (chapterError) throw new Error(chapterError.message);

  for (const book of books) {
    const existing = existingBySlug.get(book.slug)!;
    const chapterNumbers = book.chapters.map((chapter) => chapter.number).join(",");
    const { error: deleteError } = await supabase.from("chapters").delete().eq("book_id", existing.id).not("chapter_number", "in", `(${chapterNumbers})`);
    if (deleteError) throw new Error(`Could not remove stale chapters for ${existing.title}: ${deleteError.message}`);
    const { error: finalizeError } = await supabase.from("books").update({ total_chapters: book.chapters.length }).eq("id", existing.id);
    if (finalizeError) throw new Error(`Could not finalize ${existing.title}: ${finalizeError.message}`);
  }

  return { ok: true, importedBooks: books.length, importedChapters: chapterRows.length, books: existingBooks.map(({ id, slug, title }) => ({ id, slug, title })) };
}

export async function importBooks(supabase: SupabaseClient, payload: { books?: BookInput[]; updateMode?: unknown }) {
  if (!Array.isArray(payload.books) || !payload.books.length || payload.books.length > MAX_BOOKS) throw new Error(`Provide between 1 and ${MAX_BOOKS} books.`);
  if (payload.updateMode !== undefined && payload.updateMode !== "chapters-only") throw new Error("updateMode must be 'chapters-only' when provided.");
  const chaptersOnly = payload.updateMode === "chapters-only";
  const books: NormalizedBook[] = [];
  for (const [index, input] of payload.books.entries()) { const book = normalizeBook(input, index, { chaptersOnly, deferClassicIntegrity: chaptersOnly }); if ("error" in book) throw new Error(book.error); books.push(book); }
  if (new Set(books.map((book) => book.slug)).size !== books.length) throw new Error("Each book needs a unique slug.");
  if (books.reduce((total, book) => total + book.chapters.length, 0) > MAX_CHAPTERS) throw new Error(`A batch can contain at most ${MAX_CHAPTERS} chapters.`);
  if (chaptersOnly) return importChaptersOnly(supabase, books, payload.books);
  const now = new Date().toISOString(); const coverVersion = Date.now(); const coversBySlug = new Map<string, string>();
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
    const { data } = supabase.storage.from("covers").getPublicUrl(path); coversBySlug.set(book.slug, `${data.publicUrl}?v=${coverVersion}`);
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
