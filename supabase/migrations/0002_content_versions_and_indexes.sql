-- Content cache invalidation and query indexes for the Soma MVP.
alter table public.chapters add column if not exists content_version integer not null default 1 check (content_version > 0);

create or replace function public.bump_chapter_content_version()
returns trigger
language plpgsql
as $$
begin
  if new.content is distinct from old.content then
    new.content_version = old.content_version + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists chapters_bump_content_version on public.chapters;
create trigger chapters_bump_content_version
  before update on public.chapters
  for each row execute procedure public.bump_chapter_content_version();

create index if not exists events_reader_day_idx on public.reading_events (created_at desc, user_id, anonymous_id);
create index if not exists bookshelf_book_idx on public.bookshelf (book_id, created_at desc);
