
import { findPublishedBook, listPublishedChapterWindow } from "@/app/lib/content-repository";

type RouteContext = { params: Promise<{ bookSlug: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { bookSlug } = await params;
  const url = new URL(request.url);
  const from = Number(url.searchParams.get("from"));
  const limit = Number(url.searchParams.get("limit"));
  if (!Number.isInteger(from) || from < 1 || !Number.isInteger(limit) || limit < 1 || limit > 20) {
    return Response.json({ error: "Use a chapter number from 1 and a limit from 1 to 20." }, {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const book = await findPublishedBook(bookSlug);
  if (!book) {
    return Response.json({ error: "Book not found." }, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const chapters = await listPublishedChapterWindow(bookSlug, from, limit, book.id);
  return Response.json({ chapters }, {
    // Published chapter text is immutable once released; let the edge cache it so repeat
    // reads don't burn Worker invocations or Supabase round-trips. Errors stay no-store.
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
