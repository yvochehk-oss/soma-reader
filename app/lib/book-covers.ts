import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_COVERS = 20;

type CoverInput = { slug?: unknown; coverDataUrl?: unknown };

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }

function decodeCover(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match || match[2].length > 7_000_000) return null;
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { contentType: match[1], bytes };
}

export async function updateBookCovers(supabase: SupabaseClient, payload: { covers?: CoverInput[] }) {
  if (!Array.isArray(payload.covers) || !payload.covers.length || payload.covers.length > MAX_COVERS) {
    throw new Error(`Provide between 1 and ${MAX_COVERS} covers.`);
  }
  const inputs = payload.covers.map((input, index) => {
    const slug = text(input.slug);
    const coverDataUrl = text(input.coverDataUrl);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`Cover ${index + 1} has an invalid book slug.`);
    const cover = decodeCover(coverDataUrl);
    if (!cover) throw new Error(`Cover ${index + 1} is invalid or exceeds the image size limit.`);
    return { slug, cover };
  });
  if (new Set(inputs.map((input) => input.slug)).size !== inputs.length) throw new Error("Each cover needs a unique book slug.");

  const slugs = inputs.map((input) => input.slug);
  const { data: books, error: listError } = await supabase.from("books").select("id,slug").in("slug", slugs);
  if (listError) throw new Error(listError.message);
  const booksBySlug = new Map((books ?? []).map((book: { id: string; slug: string }) => [book.slug, book]));
  const missing = slugs.filter((slug) => !booksBySlug.has(slug));
  if (missing.length) throw new Error(`These books do not exist: ${missing.join(", ")}`);

  const updatedAt = Date.now();
  const updated = [];
  for (const input of inputs) {
    const extension = input.cover.contentType === "image/png" ? "png" : input.cover.contentType === "image/webp" ? "webp" : "jpg";
    const path = `imports/${input.slug}/cover.${extension}`;
    const { error: uploadError } = await supabase.storage.from("covers").upload(path, input.cover.bytes, { upsert: true, contentType: input.cover.contentType, cacheControl: "31536000" });
    if (uploadError) throw new Error(`Could not upload cover for ${input.slug}: ${uploadError.message}`);
    const { data: publicUrl } = supabase.storage.from("covers").getPublicUrl(path);
    const coverUrl = `${publicUrl.publicUrl}?v=${updatedAt}`;
    const { error: updateError } = await supabase.from("books").update({ cover_url: coverUrl }).eq("slug", input.slug);
    if (updateError) throw new Error(`Could not update cover for ${input.slug}: ${updateError.message}`);
    updated.push({ slug: input.slug, coverUrl });
  }
  return { ok: true, updatedCovers: updated.length, books: updated };
}
