alter table public.announcements
  alter column is_published set default true;

update public.announcements
set is_published = true,
    published_at = coalesce(published_at, created_at, now())
where not is_published
   or published_at is null;
