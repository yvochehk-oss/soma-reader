export const SITE_NAME = "Soma Novel";
// Canonical site URL: prefer NEXT_PUBLIC_CANONICAL_URL (explicit override) and
// fall back to NEXT_PUBLIC_SITE_URL (Cloudflare Worker variable). The final
// fallback is the public domain so local builds still produce valid metadata.
export const SITE_URL = process.env.NEXT_PUBLIC_CANONICAL_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://somanovel.uk";
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "contact@somanovel.uk";
