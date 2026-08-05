import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function POST(request: Request) {
  try {
    const { bookId } = await request.json();
    const { supabase, user } = await currentUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    if (!bookId) return NextResponse.json({ error: "bookId is required" }, { status: 400 });
    const { error } = await supabase.from("bookshelf").upsert({ user_id: user.id, book_id: bookId });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
}

export async function DELETE(request: Request) {
  try {
    const { bookId } = await request.json();
    const { supabase, user } = await currentUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const { error } = await supabase.from("bookshelf").delete().eq("user_id", user.id).eq("book_id", bookId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
}
