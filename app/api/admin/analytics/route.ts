import { NextResponse } from "next/server";
import { requireEditor } from "@/app/lib/admin-access";

export async function GET() {
  const { supabase, allowed } = await requireEditor();
  if (!allowed) return NextResponse.json({ error: "Editor access required" }, { status: 403 });
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [{ count: bookViews }, { count: downloads }, { count: published }, { data: chapterOne }, { data: chapterThree }, { data: todayEvents }] = await Promise.all([
    supabase.from("reading_events").select("id", { count: "exact", head: true }).eq("event_type", "book_view").gte("created_at", since),
    supabase.from("reading_events").select("id", { count: "exact", head: true }).eq("event_type", "offline_download").gte("created_at", since),
    supabase.from("books").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("chapters").select("id").eq("chapter_number", 1),
    supabase.from("chapters").select("id").eq("chapter_number", 3),
    supabase.from("reading_events").select("user_id,anonymous_id").gte("created_at", today.toISOString()),
  ]);
  const chapterOneIds = (chapterOne ?? []).map((row) => row.id);
  const chapterThreeIds = (chapterThree ?? []).map((row) => row.id);
  const [{ count: chapterOneCompletions }, { count: chapterThreeStarts }] = await Promise.all([
    chapterOneIds.length ? supabase.from("reading_events").select("id", { count: "exact", head: true }).eq("event_type", "chapter_complete").in("chapter_id", chapterOneIds).gte("created_at", since) : Promise.resolve({ count: 0 }),
    chapterThreeIds.length ? supabase.from("reading_events").select("id", { count: "exact", head: true }).eq("event_type", "chapter_start").in("chapter_id", chapterThreeIds).gte("created_at", since) : Promise.resolve({ count: 0 }),
  ]);
  const readersToday = new Set((todayEvents ?? []).map((event) => event.user_id ?? event.anonymous_id).filter(Boolean)).size;
  return NextResponse.json({ bookViews: bookViews ?? 0, chapterOneCompletions: chapterOneCompletions ?? 0, chapterThreeStarts: chapterThreeStarts ?? 0, downloads: downloads ?? 0, published: published ?? 0, readersToday });
}
