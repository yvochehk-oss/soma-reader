import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";

type RuntimeEnv = Record<string, string | undefined>;

export async function getPublicSupabaseEnv() {
  const fallback = process.env as RuntimeEnv;
  if (fallback.NEXT_PUBLIC_SUPABASE_URL && fallback.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { url: fallback.NEXT_PUBLIC_SUPABASE_URL, key: fallback.NEXT_PUBLIC_SUPABASE_ANON_KEY };
  }
  try {
    const { env } = await getCloudflareContext({ async: true });
    const runtime = env as unknown as RuntimeEnv;
    return {
      url: runtime.NEXT_PUBLIC_SUPABASE_URL ?? fallback.NEXT_PUBLIC_SUPABASE_URL,
      key: runtime.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? fallback.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    };
  } catch {
    return { url: fallback.NEXT_PUBLIC_SUPABASE_URL, key: fallback.NEXT_PUBLIC_SUPABASE_ANON_KEY };
  }
}

export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = await getPublicSupabaseEnv();
  if (!url || !key) throw new Error("Supabase public environment variables are missing.");
  return createServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* Server Components cannot always write cookies. */ }
      },
    },
  });
}
