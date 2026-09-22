# Cloudflare deployment

The production target is the `soma-reader` Worker using OpenNext. The site is served on the canonical `somanovel.uk` domain via Cloudflare.

## First deploy checklist

```bash
npx wrangler login
npm run cf:deploy
```

After the Worker is live, ensure `somanovel.uk` is attached from the Worker **Domains & routes** screen. Add the Supabase URL, anon key and server-only service role key as Worker environment variables; never put the service role key in a `NEXT_PUBLIC_` variable.

The current config uses OpenNext for the Supabase-backed routes and server APIs, then merges the Vite reader shell into `.open-next/assets` for the root page. `npm run cf:build` always regenerates both halves before deployment. Use `npm run dev` for the Vite reader, `npm run dev:next` for the Next administration and database routes, and `npm run cf:preview` to test the combined Worker runtime locally.
