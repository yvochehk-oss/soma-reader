import { NextResponse } from "next/server";
import { requireAdmin, requireEditor } from "@/app/lib/admin-access";

function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }

export async function POST(request: Request) {
  try {
    const input = await request.json();
    const { supabase, allowed } = await requireEditor();
    if (!allowed) return NextResponse.json({ error: "Editor access required" }, { status: 403 });
    const title = String(input.title ?? "").trim();
    const author = String(input.authorName ?? "").trim();
    const slug = slugify(input.slug || title);
    if (!title || !author || !slug) return NextResponse.json({ error: "Title and author are required" }, { status: 400 });
    const { data, error } = await supabase.from("books").insert({ slug, title, author_name: author, language_code: input.language === "sw" ? "sw" : "en", category: String(input.category ?? "other").trim() || "other", description: String(input.description ?? ""), status: "draft" }).select("id,slug").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ book: data }, { status: 201 });
  } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
}

function coverPath(url: string | null) {
  if (!url) return null;
  const marker = "/storage/v1/object/public/covers/";
  const index = url.indexOf(marker);
  return index < 0 ? null : decodeURIComponent(url.slice(index + marker.length).split("?")[0]);
}

export async function DELETE() {
  try {
    const { supabase, allowed } = await requireAdmin();
    if (!allowed) return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
    const { data: books, error: listError } = await supabase.from("books").select("id,cover_url");
    if (listError) return NextResponse.json({ error: listError.message }, { status: 400 });
    const paths = [...new Set((books ?? []).map((book) => coverPath(book.cover_url)).filter((path): path is string => Boolean(path)))];
    if (paths.length) {
      const { error } = await supabase.storage.from("covers").remove(paths);
      if (error) return NextResponse.json({ error: `Could not remove covers: ${error.message}` }, { status: 400 });
    }
    const { error } = await supabase.from("books").delete().not("id", "is", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ deletedBooks: books?.length ?? 0, deletedCovers: paths.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not clear the book library" }, { status: 400 });
  }
}
