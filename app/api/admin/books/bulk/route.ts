import { NextResponse } from "next/server";
import { requireEditor } from "@/app/lib/admin-access";
import { importBooks } from "@/app/lib/book-import";

export async function POST(request: Request) {
  try {
    const { supabase, allowed } = await requireEditor();
    if (!allowed) return NextResponse.json({ error: "Editor access required" }, { status: 403 });
    return NextResponse.json(await importBooks(supabase, await request.json()));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 });
  }
}
