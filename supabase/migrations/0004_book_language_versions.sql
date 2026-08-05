-- A translation points to its original work. One work has one version per language.
create unique index if not exists books_parent_language_unique_idx
  on public.books (parent_book_id, language_code)
  where parent_book_id is not null;

create index if not exists books_parent_book_idx on public.books (parent_book_id);
