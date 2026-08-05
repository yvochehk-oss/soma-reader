import { NextResponse } from "next/server";
import { requireEditor } from "@/app/lib/admin-access";

type ImportPayload = { bookId?: string; title?: string; author?: string; language?: "en" | "sw"; description?: string; category?: string; chapters: { number: number; title: string; content: string }[] };
type ImportedBook = { id: string; slug: string; status: "draft" | "published" | "hidden"; published_at: string | null };

export async function POST(request: Request) {
  try {
    const { supabase, allowed } = await requireEditor();
    if (!allowed) return NextResponse.json({ error: "Editor access required" }, { status: 403 });
    const payload = await request.json() as ImportPayload;
    if (!payload.chapters?.length || payload.chapters.length > 100) return NextResponse.json({ error: "Provide between 1 and 100 chapters" }, { status: 400 });
    if (new Set(payload.chapters.map((chapter) => chapter.number)).size !== payload.chapters.length || payload.chapters.some((chapter) => !Number.isSafeInteger(chapter.number) || chapter.number < 1 || !chapter.title.trim() || !chapter.content.trim())) return NextResponse.json({ error: "Every chapter needs a unique positive integer number, title and content" }, { status: 400 });
    let book: ImportedBook | null = null;
    if (payload.bookId) {
      const { data, error } = await supabase.from("books").select("id,slug,status,published_at").eq("id", payload.bookId).single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      book = data;
      const { error: stageError } = await supabase.from("books").update({ status: "draft" }).eq("id", book.id);
      if (stageError) return NextResponse.json({ error: stageError.message }, { status: 400 });
    } else {
      if (!payload.title || !payload.author || !payload.language) return NextResponse.json({ error: "title, author and language are required" }, { status: 400 });
      const slug = payload.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const { data, error } = await supabase.from("books").insert({ slug, title: payload.title, author_name: payload.author, description: payload.description ?? "", language_code: payload.language, category: payload.category ?? "other", status: "draft", total_chapters: payload.chapters.length }).select("id,slug,status,published_at").single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      book = data;
    }
    const rows = payload.chapters.map((chapter) => ({ book_id: book.id, chapter_number: chapter.number, title: chapter.title, content: chapter.content, word_count: chapter.content.trim().split(/\s+/).filter(Boolean).length }));
    const { error: chapterError } = await supabase.from("chapters").upsert(rows, { onConflict: "book_id,chapter_number" });
    if (chapterError) return NextResponse.json({ error: chapterError.message }, { status: 400 });
    const chapterNumbers = payload.chapters.map((chapter) => chapter.number).join(",");
    const { error: staleError } = await supabase.from("chapters").delete().eq("book_id", book.id).not("chapter_number", "in", `(${chapterNumbers})`);
    if (staleError) return NextResponse.json({ error: staleError.message }, { status: 400 });
    const { error: finalizeError } = await supabase.from("books").update({ status: book.status, published_at: book.published_at, total_chapters: payload.chapters.length }).eq("id", book.id);
    if (finalizeError) return NextResponse.json({ error: finalizeError.message }, { status: 400 });
    return NextResponse.json({ ok: true, book });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 }); }
}
