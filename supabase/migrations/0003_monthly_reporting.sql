-- Monthly analytics is retained indefinitely; raw events are deleted only after a successful email report.
create type public.monthly_report_status as enum ('pending', 'sent', 'failed');

create table public.monthly_event_rollups (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  book_id uuid references public.books(id) on delete set null,
  event_type text not null,
  event_count bigint not null default 0,
  unique_readers bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (period_start, book_id, event_type)
);

create table public.monthly_report_runs (
  id uuid primary key default gen_random_uuid(),
  period_start date not null unique,
  period_end date not null,
  recipient text not null,
  status public.monthly_report_status not null default 'pending',
  retention_cutoff timestamptz not null,
  resend_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index monthly_event_rollups_period_idx on public.monthly_event_rollups (period_start desc, event_type);
create trigger report_runs_touch_updated_at before update on public.monthly_report_runs for each row execute procedure public.touch_updated_at();

alter table public.monthly_event_rollups enable row level security;
alter table public.monthly_report_runs enable row level security;

create or replace function public.rollup_reading_events(month_start date, month_end date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.monthly_event_rollups where period_start = month_start;
  insert into public.monthly_event_rollups (period_start, period_end, book_id, event_type, event_count, unique_readers)
  select
    month_start,
    month_end,
    book_id,
    event_type,
    count(*)::bigint,
    count(distinct coalesce(user_id::text, anonymous_id))::bigint
  from public.reading_events
  where created_at >= month_start::timestamptz and created_at < month_end::timestamptz
  group by book_id, event_type;
end;
$$;

create or replace function public.purge_reading_events_after_report(report_run_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff timestamptz;
  deleted_count bigint;
begin
  select retention_cutoff into cutoff
  from public.monthly_report_runs
  where id = report_run_id and status = 'sent' and sent_at is not null;

  if cutoff is null then
    raise exception 'Monthly report must be sent before events can be deleted';
  end if;

  delete from public.reading_events where created_at < cutoff;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
