import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { importBooks } from "@/app/lib/book-import";
import { createAdminClient, getServerSecret } from "@/app/lib/supabase/admin";

async function authorize(request: Request) {
  const expectedToken = await getServerSecret("BOOK_IMPORT_TOKEN");
  if (!expectedToken) return false;

  const authorization = request.headers.get("authorization") ?? "";
  const providedToken = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
  const expectedBytes = Buffer.from(expectedToken, "utf8");
  const providedBytes = Buffer.from(providedToken, "utf8");
  return expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes);
}

function coverPath(url: string | null) {
  if (!url) return null;
  const marker = "/storage/v1/object/public/covers/";
  const index = url.indexOf(marker);
  return index < 0 ? null : decodeURIComponent(url.slice(index + marker.length).split("?")[0]);
}

export async function POST(request: Request) {
  if (!(await authorize(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await importBooks(await createAdminClient(), await request.json()));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Import failed" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!(await authorize(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const supabase = await createAdminClient();
    const { data: books, error: listError } = await supabase.from("books").select("id,cover_url");
    if (listError) throw new Error(listError.message);
    const covers = [...new Set((books ?? []).map((book) => coverPath(book.cover_url)).filter((path): path is string => Boolean(path)))];
    if (covers.length) {
      const { error } = await supabase.storage.from("covers").remove(covers);
      if (error) throw new Error(`Could not remove covers: ${error.message}`);
    }
    const { error } = await supabase.from("books").delete().not("id", "is", null);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, deletedBooks: books?.length ?? 0, deletedCovers: covers.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not clear the book library" }, { status: 400 });
  }
}
