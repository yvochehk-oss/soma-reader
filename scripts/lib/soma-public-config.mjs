import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

function readEnvFile(path) {
  return readFile(path, "utf8").then((text) => {
    const map = {};
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const equals = trimmed.indexOf("=");
      if (equals <= 0) continue;
      const key = trimmed.slice(0, equals).trim();
      let value = trimmed.slice(equals + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      map[key] = value;
    }
    return map;
  }).catch(() => ({}));
}

async function loadEnvFiles() {
  const merged = {};
  for (const candidate of [".env", ".env.local", ".env.production"]) {
    Object.assign(merged, await readEnvFile(resolve(candidate)));
  }
  return merged;
}

export async function getSupabasePublicConfig() {
  const fileEnv = await loadEnvFiles();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    || process.env.VITE_SUPABASE_URL
    || fileEnv.NEXT_PUBLIC_SUPABASE_URL
    || fileEnv.VITE_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || process.env.VITE_SUPABASE_ANON_KEY
    || fileEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || fileEnv.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase public URL/key are required. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in the environment (or .env) before running this script."
    );
  }
  return { url: url.replace(/\/$/, ""), key };
}
