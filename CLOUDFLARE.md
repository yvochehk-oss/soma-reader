# Cloudflare deployment

The production target is the `soma-reader` Worker using OpenNext. The site is served on the canonical `somanovel.uk` domain via Cloudflare.

## First deploy checklist

```bash
npx wrangler login
npm run cf:deploy
```

After the Worker is live, ensure `somanovel.uk` is attached from the Worker **Domains & routes** screen. Add the Supabase URL, anon key and server-only service role key as Worker environment variables; never put the service role key in a `NEXT_PUBLIC_` variable.

The current config uses OpenNext for the Supabase-backed routes and server APIs, then merges the Vite reader shell into `.open-next/assets` for the root page. `npm run cf:build` always regenerates both halves before deployment. Use `npm run dev` for the Vite reader, `npm run dev:next` for the Next administration and database routes, and `npm run cf:preview` to test the combined Worker runtime locally.

## Data-only deployment branch (NOT enabled in production)

Implementation branch: `codex/soma-incremental-deploy-2026-10-09`.
The existing `npm run cf:build`, `npm run cf:deploy` and
`npm run release:books` retain their legacy FULL behavior.
The new data-only pathway is opt-in and subject to safety gates.

- `npm run test:incremental-deploy`: offline tests for owned SEO files,
  protected assets, locking, fingerprints, homepage patching, and fallback.
- `node scripts/code-hash.mjs verify --target preview`: returns
  DATA only when a separately verified preview cache and deploy state exist.
- `node scripts/sync-data-assets.mjs --dry-run --source <public> --target <assets>`
  reports byte-hash changes without mutating the target.
- `node scripts/deploy-soma-site.mjs --target preview --data-only --dry-run`
  constructs an isolated candidate, then runs Wrangler dry-run only.
  Preview requires all three: `SOMA_PREVIEW_SUPABASE_URL`,
  `SOMA_PREVIEW_SUPABASE_ANON_KEY`, and `SOMA_PREVIEW_BASE_URL`.
  These **must** refer to a test Supabase project and a dedicated
  workers.dev preview URL, never the production database.
- Real preview deployment supports `--scenario added|updated|withdrawn`.
  Each needs its own verified deployment ID; the evidence must cover all
  three cases before the production path is allowed.
- `--target production --data-only --approve-production` is gated by
  the three-scenario preview evidence. It must not be run before the
  deployment owner has approved production grey release.

SEO artifacts now include `catalog/home-seo.json`; the generator no longer
rewrites tracked `index.html`. Both FULL and DATA channels patch the built
homepage only. The generated `.build-manifest.json` is a candidate marker,
**never** proof that Cloudflare deployment succeeded.

Successful deployment state is kept separately at
`.soma-deploy-state/<target>.json`. Immutable versioned snapshots live
at `.soma-deploy-cache/<target>/<run-id>`; working audits and candidates
live at `.soma-deploy-work/<run-id>`. Preserve these directories on the
persistent deployment machine. If they are missing or mismatched, the
system falls back to a fresh FULL build; it never reuses unverified assets.

A remote deployment with failed or unknown verification enters
`REMOTE_DEPLOYED_UNVERIFIED`. Before retrying, inspect Wrangler's live
deployment ID and affected URLs. A Worker rollback does not roll back
Supabase rows. Never edit the production cron until A0-A4 and three real
preview scenarios are independently verified.