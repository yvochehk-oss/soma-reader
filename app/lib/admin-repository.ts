import { createClient, getPublicSupabaseEnv } from "@/app/lib/supabase/server";

export type AdminBook = { id: string; slug: string; title: string; author_name: string; language_code: "en" | "sw"; category: string; description: string; cover_url: string | null; status: "draft" | "published" | "hidden"; total_chapters: number; is_featured: boolean };

async function configured() { const { url, key } = await getPublicSupabaseEnv(); return Boolean(url && key); }

export async function listAdminBooks() {
  if (!(await configured())) return [] as AdminBook[];
  const supabase = await createClient();
  const { data } = await supabase.from("books").select("id,slug,title,author_name,language_code,category,description,cover_url,status,total_chapters,is_featured").order("updated_at", { ascending: false });
  return (data ?? []) as AdminBook[];
}

export async function findAdminBook(id: string) {
  if (!(await configured())) return undefined;
  const supabase = await createClient();
  const { data } = await supabase.from("books").select("id,slug,title,author_name,language_code,category,description,cover_url,status,total_chapters,is_featured").eq("id", id).maybeSingle();
  return data as AdminBook | null;
}

export async function listAdminChapters(bookId: string) {
  if (!(await configured())) return [] as Array<{ id: string; chapter_number: number; title: string; content: string; status: "draft" | "published"; word_count: number }>;
  const supabase = await createClient();
  const { data } = await supabase.from("chapters").select("id,chapter_number,title,content,status,word_count").eq("book_id", bookId).order("chapter_number");
  return (data ?? []) as Array<{ id: string; chapter_number: number; title: string; content: string; status: "draft" | "published"; word_count: number }>;
}
