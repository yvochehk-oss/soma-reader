import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { updateBookCovers } from "@/app/lib/book-covers";
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

export async function POST(request: Request) {
  if (!(await authorize(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await updateBookCovers(await createAdminClient(), await request.json()));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Cover update failed" }, { status: 400 });
  }
}
