/**
 * Canonical site configuration helpers shared by server routes, edge workers,
 * and client components. Always prefer these helpers over inline
 * `process.env.NEXT_PUBLIC_SITE_URL` reads so the fallback chain stays
 * consistent across the codebase.
 */

export const SITE_URL_DEFAULT = "https://somanovel.uk";

/**
 * Resolve the canonical site URL with the same fallback chain used in
 * `site-config.ts`. The trailing slash is always stripped so callers can
 * safely append paths.
 *
 * @param explicitOverride Allow the caller to force a specific origin (e.g.
 *                         from `request.url` when running inside a Worker).
 */
export function getSiteUrl(explicitOverride?: string | null): string {
  const candidate =
    explicitOverride?.replace(/\/$/, "")
    || process.env.NEXT_PUBLIC_CANONICAL_URL?.replace(/\/$/, "")
    || process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "")
    || SITE_URL_DEFAULT;
  return candidate || SITE_URL_DEFAULT;
}
