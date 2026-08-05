-- Soma initial schema: public content, private reader state, admin-managed publishing.
create extension if not exists "pgcrypto";

create type public.user_role as enum ('reader', 'editor', 'admin');
create type public.book_status as enum ('draft', 'published', 'hidden');
create type public.chapter_status as enum ('draft', 'published');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  role public.user_role not null default 'reader',
  preferred_language text not null default 'en' check (preferred_language in ('en', 'sw')),
  created_at timestamptz not null default now()
);

create table public.books (
  id uuid primary key default gen_random_uuid(),
  parent_book_id uuid references public.books(id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null,
  author_name text not null,
  description text not null default '',
  cover_url text,
  language_code text not null check (language_code in ('en', 'sw')),
  category text not null default 'other',
  tags text[] not null default '{}',
  status public.book_status not null default 'draft',
  is_featured boolean not null default false,
  total_chapters integer not null default 0 check (total_chapters >= 0),
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  chapter_number integer not null check (chapter_number > 0),
  title text not null,
  content text not null default '',
  status public.chapter_status not null default 'draft',
  is_free boolean not null default true,
  word_count integer not null default 0 check (word_count >= 0),
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (book_id, chapter_number)
);

create table public.bookshelf (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

create table public.reading_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  chapter_id uuid references public.chapters(id) on delete set null,
  chapter_number integer not null default 1 check (chapter_number > 0),
  scroll_percent numeric(5,2) not null default 0 check (scroll_percent >= 0 and scroll_percent <= 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

create table public.reading_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  anonymous_id text,
  book_id uuid references public.books(id) on delete set null,
  chapter_id uuid references public.chapters(id) on delete set null,
  event_type text not null check (event_type in ('book_view', 'chapter_start', 'chapter_25', 'chapter_50', 'chapter_75', 'chapter_complete', 'bookshelf_add', 'offline_download')),
  reading_seconds integer check (reading_seconds is null or reading_seconds >= 0),
  created_at timestamptz not null default now(),
  check (user_id is not null or anonymous_id is not null)
);

create index books_published_idx on public.books (status, is_featured, updated_at desc);
create index chapters_book_order_idx on public.chapters (book_id, status, chapter_number);
create index events_created_idx on public.reading_events (created_at desc);
create index events_book_idx on public.reading_events (book_id, event_type, created_at desc);

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email), new.raw_user_meta_data ->> 'avatar_url');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger books_touch_updated_at before update on public.books for each row execute procedure public.touch_updated_at();
create trigger chapters_touch_updated_at before update on public.chapters for each row execute procedure public.touch_updated_at();
create trigger progress_touch_updated_at before update on public.reading_progress for each row execute procedure public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.chapters enable row level security;
alter table public.bookshelf enable row level security;
alter table public.reading_progress enable row level security;
alter table public.reading_events enable row level security;

create policy "profiles are visible to their owner or admins" on public.profiles for select using (id = auth.uid() or public.current_user_role() in ('editor', 'admin'));
create policy "users can update their own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "published books are public" on public.books for select using (status = 'published' or public.current_user_role() in ('editor', 'admin'));
create policy "editors manage books" on public.books for all using (public.current_user_role() in ('editor', 'admin')) with check (public.current_user_role() in ('editor', 'admin'));

create policy "published chapters are public" on public.chapters for select using ((status = 'published' and exists (select 1 from public.books where books.id = chapters.book_id and books.status = 'published')) or public.current_user_role() in ('editor', 'admin'));
create policy "editors manage chapters" on public.chapters for all using (public.current_user_role() in ('editor', 'admin')) with check (public.current_user_role() in ('editor', 'admin'));

create policy "users manage their own shelf" on public.bookshelf for all using (user_id = auth.uid() or public.current_user_role() = 'admin') with check (user_id = auth.uid() or public.current_user_role() = 'admin');
create policy "users manage their own progress" on public.reading_progress for all using (user_id = auth.uid() or public.current_user_role() = 'admin') with check (user_id = auth.uid() or public.current_user_role() = 'admin');

create policy "readers can create their own events" on public.reading_events for insert with check (user_id = auth.uid() or (user_id is null and anonymous_id is not null));
create policy "admins can inspect events" on public.reading_events for select using (public.current_user_role() = 'admin');

insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

create policy "cover images are public" on storage.objects for select using (bucket_id = 'covers');
create policy "editors upload covers" on storage.objects for insert with check (bucket_id = 'covers' and public.current_user_role() in ('editor', 'admin'));
create policy "editors update covers" on storage.objects for update using (bucket_id = 'covers' and public.current_user_role() in ('editor', 'admin')) with check (bucket_id = 'covers' and public.current_user_role() in ('editor', 'admin'));
create policy "editors delete covers" on storage.objects for delete using (bucket_id = 'covers' and public.current_user_role() in ('editor', 'admin'));
