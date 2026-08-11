export const SITE_NAME = "Soma Novel";
// NEXT_PUBLIC_SITE_URL is retained by older deployments for a retired host.
// Use a dedicated canonical override so metadata can never silently drift back
// to that legacy domain.
export const SITE_URL = process.env.NEXT_PUBLIC_CANONICAL_URL || "https://somanovel.uk";
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "contact@somanovel.uk";
