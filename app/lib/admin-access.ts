import { createClient } from "@/app/lib/supabase/server";

export async function requireEditor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, role: null, allowed: false };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return { supabase, user, role: profile?.role ?? null, allowed: profile?.role === "admin" || profile?.role === "editor" };
}

export async function requireAdmin() {
  const access = await requireEditor();
  return { ...access, allowed: access.role === "admin" };
}
