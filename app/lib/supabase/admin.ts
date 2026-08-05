import { createClient } from "@supabase/supabase-js";
import { getCloudflareContext } from "@opennextjs/cloudflare";

type RuntimeEnv = Record<string, string | undefined>;

async function runtimeEnv(required: string[]) {
  const fallback = process.env as RuntimeEnv;
  if (required.every((name) => fallback[name])) return fallback;
  try {
    const { env } = await getCloudflareContext({ async: true });
    return { ...fallback, ...(env as unknown as RuntimeEnv) };
  } catch {
    return fallback;
  }
}

export async function getServerSecret(name: string) {
  return (await runtimeEnv([name]))[name];
}

export async function createAdminClient() {
  const env = await runtimeEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables are missing.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
