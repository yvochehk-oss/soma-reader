import { NextResponse } from "next/server";
import { requireEditor } from "@/app/lib/admin-access";

const permitted = ["title", "author_name", "language_code", "category", "description", "cover_url", "status", "is_featured", "published_at"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const input = await request.json();
    const update = Object.fromEntries(Object.entries(input).filter(([key]) => permitted.includes(key)));
    const { supabase, allowed } = await requireEditor();
    if (!allowed) return NextResponse.json({ error: "Editor access required" }, { status: 403 });
    if (update.status === "published") {
      const { data: current, error: currentError } = await supabase.from("books").select("cover_url,description").eq("id", id).single();
      if (currentError) return NextResponse.json({ error: currentError.message }, { status: 400 });
      const coverUrl = String(update.cover_url ?? current.cover_url ?? "").trim();
      const description = String(update.description ?? current.description ?? "").trim();
      if (!coverUrl) return NextResponse.json({ error: "Add a cover image before publishing." }, { status: 400 });
      if (!description) return NextResponse.json({ error: "Add a description before publishing." }, { status: 400 });
      if (!update.published_at) update.published_at = new Date().toISOString();
    }
    const { data, error } = await supabase.from("books").update(update).eq("id", id).select("id,slug").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ book: data });
  } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
}
