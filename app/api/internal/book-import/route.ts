import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { importBooks } from "@/app/lib/book-import";
import { inspectBookRelease } from "@/app/lib/book-release-audit";
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

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, {
    status: 401,
    headers: {
      "Cache-Control": "no-store",
      "WWW-Authenticate": 'Bearer realm="soma-internal"',
    },
  });
}

function coverPath(url: string | null) {
  if (!url) return null;
  const marker = "/storage/v1/object/public/covers/";
  const index = url.indexOf(marker);
  return index < 0 ? null : decodeURIComponent(url.slice(index + marker.length).split("?")[0]);
}

export async function GET(request: Request) {
  if (!(await authorize(request))) return unauthorized();
  try {
    const slugs = [...new Set(new URL(request.url).searchParams.getAll("slug").map((slug) => slug.trim()))];
    if (!slugs.length || slugs.length > 20 || slugs.some((slug) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))) {
      return NextResponse.json({ error: "Provide between 1 and 20 valid slug query parameters." }, { status: 400 });
    }
    const books = await inspectBookRelease(await createAdminClient(), slugs);
    return NextResponse.json({ ok: true, books, missingSlugs: slugs.filter((slug) => !books.some((book) => book.slug === slug)) }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Release audit failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await authorize(request))) return unauthorized();
  try {
    return NextResponse.json(await importBooks(await createAdminClient(), await request.json()));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Import failed" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!(await authorize(request))) return unauthorized();
  try {
    const payload = await request.json().catch(() => ({})) as { slugs?: unknown; deleteAll?: unknown; confirmation?: unknown };
    const deleteAll = payload.deleteAll === true && payload.confirmation === "DELETE ALL SOMA BOOKS";
    const slugs = Array.isArray(payload.slugs)
      ? [...new Set(payload.slugs.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter((value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)))]
      : [];
    if (!deleteAll && (!slugs.length || slugs.length > 50)) {
      return NextResponse.json({ error: "Provide between 1 and 50 explicit book slugs. Full-library deletion requires the exact confirmation phrase." }, { status: 400 });
    }
    const supabase = await createAdminClient();
    let query = supabase.from("books").select("id,slug,cover_url");
    if (!deleteAll) query = query.in("slug", slugs);
    const { data: books, error: listError } = await query;
    if (listError) throw new Error(listError.message);
    const covers = [...new Set((books ?? []).map((book) => coverPath(book.cover_url)).filter((path): path is string => Boolean(path)))];
    if (covers.length) {
      const { error } = await supabase.storage.from("covers").remove(covers);
      if (error) throw new Error(`Could not remove covers: ${error.message}`);
    }
    let deleteQuery = supabase.from("books").delete();
    deleteQuery = deleteAll ? deleteQuery.not("id", "is", null) : deleteQuery.in("slug", slugs);
    const { error } = await deleteQuery;
    if (error) throw new Error(error.message);
    const foundSlugs = new Set((books ?? []).map((book) => book.slug));
    return NextResponse.json({
      ok: true,
      deletedBooks: books?.length ?? 0,
      deletedCovers: covers.length,
      deletedSlugs: [...foundSlugs],
      missingSlugs: deleteAll ? [] : slugs.filter((slug) => !foundSlugs.has(slug)),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not clear the book library" }, { status: 400 });
  }
}
