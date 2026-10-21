alter table public.class_sessions
  alter column is_published set default true;

update public.class_sessions
set is_published = true
where not is_published;
