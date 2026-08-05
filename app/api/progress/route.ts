import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const { error } = await supabase.from("reading_progress").upsert({ user_id: user.id, book_id: body.bookId, chapter_id: body.chapterId ?? null, chapter_number: body.chapterNumber, scroll_percent: body.scrollPercent ?? 0, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
}
