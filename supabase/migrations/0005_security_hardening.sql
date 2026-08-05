-- Keep profile roles server-managed and hide content scheduled for the future.
alter policy "users can update their own profile"
on public.profiles
with check (
  id = auth.uid()
  and role = public.current_user_role()
);

alter policy "published books are public"
on public.books
using (
  (
    status = 'published'
    and (published_at is null or published_at <= now())
  )
  or public.current_user_role() in ('editor', 'admin')
);

alter policy "published chapters are public"
on public.chapters
using (
  (
    status = 'published'
    and (published_at is null or published_at <= now())
    and exists (
      select 1
      from public.books
      where books.id = chapters.book_id
        and books.status = 'published'
        and (books.published_at is null or books.published_at <= now())
    )
  )
  or public.current_user_role() in ('editor', 'admin')
);
