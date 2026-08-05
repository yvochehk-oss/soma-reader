-- Retire incomplete demo-only rows that have no chapter records in production.
update public.books
set status = 'hidden'
where slug in (
  'savannahs-secret',
  'savannahs-secret-sw',
  'nairobi-nights-shadows-gold',
  'neon-savannah',
  'watcher-in-westlands'
)
and not exists (
  select 1
  from public.chapters
  where chapters.book_id = books.id
    and chapters.status = 'published'
);

-- Keep one public card per logical work while storing language versions separately.

update public.books as translation
set parent_book_id = original.id
from public.books as original
where translation.slug = 'savannahs-secret-sw'
  and original.slug = 'savannahs-secret'
  and translation.parent_book_id is null;

alter table public.books
  add constraint books_cannot_parent_themselves
  check (parent_book_id is null or parent_book_id <> id);

create unique index books_one_version_per_work_language_idx
  on public.books ((coalesce(parent_book_id, id)), language_code);

create or replace function public.validate_book_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_language text;
  grandparent_id uuid;
begin
  if new.parent_book_id is null then
    return new;
  end if;

  select language_code, parent_book_id
  into parent_language, grandparent_id
  from public.books
  where id = new.parent_book_id;

  if parent_language is null then
    raise exception 'The original book does not exist.';
  end if;
  if grandparent_id is not null then
    raise exception 'A translation must point directly to an original book.';
  end if;
  if parent_language = new.language_code then
    raise exception 'A translation must use a different language from its original.';
  end if;

  return new;
end;
$$;

create trigger books_validate_parent
before insert or update of parent_book_id, language_code on public.books
for each row execute function public.validate_book_parent();

alter table public.books
  add constraint published_books_require_cover
  check (status <> 'published' or nullif(btrim(cover_url), '') is not null);
