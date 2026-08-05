-- Some production databases predate the monthly-reporting migration. Protect the
-- SECURITY DEFINER routines when present without blocking databases that do not have them.
do $$
begin
  if to_regprocedure('public.rollup_reading_events(date,date)') is not null then
    execute 'revoke execute on function public.rollup_reading_events(date, date) from public, anon, authenticated';
    execute 'grant execute on function public.rollup_reading_events(date, date) to service_role';
  end if;

  if to_regprocedure('public.purge_reading_events_after_report(uuid)') is not null then
    execute 'revoke execute on function public.purge_reading_events_after_report(uuid) from public, anon, authenticated';
    execute 'grant execute on function public.purge_reading_events_after_report(uuid) to service_role';
  end if;
end
$$;

-- Bound anonymous identifiers and event durations even if callers bypass the Next route.
do $$ begin
  alter table public.reading_events
    add constraint reading_events_anonymous_id_length
    check (anonymous_id is null or char_length(anonymous_id) between 8 and 128)
    not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.reading_events
    add constraint reading_events_reading_seconds_limit
    check (reading_seconds is null or reading_seconds between 0 and 86400)
    not valid;
exception when duplicate_object then null;
end $$;

create index if not exists reading_events_anonymous_rate_idx
  on public.reading_events (anonymous_id, created_at desc)
  where anonymous_id is not null;

create or replace function public.limit_anonymous_reading_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is null and (
    select count(*)
    from public.reading_events
    where anonymous_id = new.anonymous_id
      and created_at >= now() - interval '1 minute'
  ) >= 120 then
    raise exception 'Anonymous event rate limit exceeded' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.limit_anonymous_reading_events()
from public, anon, authenticated;

drop trigger if exists reading_events_limit_anonymous on public.reading_events;
create trigger reading_events_limit_anonymous
before insert on public.reading_events
for each row execute function public.limit_anonymous_reading_events();
