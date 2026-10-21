alter table public.courses
  alter column is_published set default true;

update public.courses
set is_published = true
where not is_published;
