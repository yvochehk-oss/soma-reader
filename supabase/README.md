# Supabase setup

1. Copy `.env.example` to `.env.local` and fill in the public project URL and anon key.
2. Run `supabase/migrations/0001_initial.sql` once in the project's SQL Editor.
3. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only; never prefix it with `NEXT_PUBLIC_`.

The app currently renders local demo content so the UI can be reviewed before content is imported. The next step is replacing the demo repository with Supabase queries and adding the `/admin` workflow.
