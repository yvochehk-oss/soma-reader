import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getPublicSupabaseEnv } from "@/app/lib/supabase/server";
import { getSiteUrl } from "@/app/lib/site";

function safeNextPath(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : "/library";
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));
  const siteUrl = getSiteUrl(url.origin);
  const response = NextResponse.redirect(new URL(code ? next : "/login?error=auth", siteUrl));
  if (code) {
    const { url: supabaseUrl, key } = await getPublicSupabaseEnv();
    if (!supabaseUrl || !key) return NextResponse.redirect(new URL("/login?error=auth", siteUrl));
    const supabase = createServerClient(supabaseUrl, key, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return response;
  }
  return NextResponse.redirect(new URL("/login?error=auth", siteUrl));
}
