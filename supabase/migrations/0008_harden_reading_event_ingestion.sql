-- Remove implicit function privileges and mutable search paths reported by the
-- Supabase security advisor. current_user_role() remains explicitly callable by
-- reader roles because the existing RLS policies depend on it.
alter function public.current_user_role() set search_path = '';
revoke execute on function public.current_user_role() from public;
grant execute on function public.current_user_role() to anon, authenticated;

alter function public.handle_new_user() set search_path = '';
revoke execute on function public.handle_new_user() from public, anon, authenticated;

alter function public.touch_updated_at() set search_path = '';
alter function public.bump_chapter_content_version() set search_path = '';

-- Tighten event ingestion without validating or rewriting historical analytics rows.
do $$ begin
  alter table public.reading_events
    add constraint reading_events_anonymous_id_uuid
    check (
      anonymous_id is null
      or anonymous_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    )
    not valid;
exception when duplicate_object then null;
end $$;

alter policy "readers can create their own events"
on public.reading_events
with check (
  book_id is not null
  and (
    user_id = (select auth.uid())
    or (
      (select auth.uid()) is null
      and user_id is null
      and anonymous_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    )
  )
  and (
    event_type in ('book_view', 'bookshelf_add')
    or chapter_id is not null
  )
);

create index if not exists reading_events_user_rate_idx
  on public.reading_events (user_id, created_at desc)
  where user_id is not null;

-- Postgres does not index foreign-key columns automatically. Keep these partial
-- indexes small while covering joins and parent-row deletes for non-null keys.
create index if not exists reading_events_chapter_id_idx
  on public.reading_events (chapter_id)
  where chapter_id is not null;

create index if not exists reading_progress_book_id_idx
  on public.reading_progress (book_id)
  where book_id is not null;

create index if not exists reading_progress_chapter_id_idx
  on public.reading_progress (chapter_id)
  where chapter_id is not null;

-- Serialize the count for each reader so concurrent requests cannot race past
-- the per-minute database limit. This trigger function is never an RPC endpoint.
create or replace function public.limit_anonymous_reading_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_key text;
  recent_events bigint;
begin
  actor_key := case
    when new.user_id is not null then 'user:' || new.user_id::text
    else 'anonymous:' || new.anonymous_id
  end;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor_key, 0));

  if new.user_id is not null then
    select count(*) into recent_events
    from public.reading_events
    where user_id = new.user_id
      and created_at >= pg_catalog.now() - interval '1 minute';
  else
    select count(*) into recent_events
    from public.reading_events
    where anonymous_id = new.anonymous_id
      and created_at >= pg_catalog.now() - interval '1 minute';
  end if;

  if recent_events >= 120 then
    raise exception 'Reading event rate limit exceeded' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.limit_anonymous_reading_events()
from public, anon, authenticated;
