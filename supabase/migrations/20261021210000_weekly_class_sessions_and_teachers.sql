alter table public.courses
  add column if not exists teacher_name text not null default '';

create or replace function public.create_weekly_class_sessions(
  target_course_id uuid,
  target_weekday integer,
  target_start_date date,
  target_end_date date,
  target_start_time time,
  target_end_time time,
  target_capacity integer,
  target_is_published boolean
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  course_is_published boolean;
  occurrence_date date;
  created_count integer := 0;
  occurrence_start timestamptz;
  occurrence_end timestamptz;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  if target_course_id is null
    or target_weekday is null or target_weekday < 0 or target_weekday > 6
    or target_start_date is null or target_end_date is null
    or target_start_date > target_end_date
    or target_end_date > target_start_date + 730
    or target_start_time is null or target_end_time is null
    or target_end_time <= target_start_time
    or target_capacity is null or target_capacity < 1 or target_capacity > 500
    or target_is_published is null then
    raise exception 'Invalid weekly class details';
  end if;

  select c.is_published into course_is_published
  from public.courses c
  where c.id = target_course_id
  for update;

  if not found then
    raise exception 'Course not found';
  end if;

  if target_is_published and not course_is_published then
    raise exception 'Cannot publish sessions for an unpublished course';
  end if;

  occurrence_date := target_start_date
    + ((target_weekday - extract(dow from target_start_date)::integer + 7) % 7);

  if occurrence_date > target_end_date then
    raise exception 'Date range does not include the selected weekday';
  end if;

  while occurrence_date <= target_end_date loop
    occurrence_start := (occurrence_date + target_start_time) at time zone 'Asia/Taipei';
    occurrence_end := (occurrence_date + target_end_time) at time zone 'Asia/Taipei';

    if exists (
      select 1
      from public.class_sessions s
      where s.course_id = target_course_id
        and s.starts_at = occurrence_start
    ) then
      raise exception 'A session for this course already exists on %', occurrence_date;
    end if;

    insert into public.class_sessions (
      course_id, starts_at, ends_at, capacity, is_published
    )
    values (
      target_course_id, occurrence_start, occurrence_end,
      target_capacity, target_is_published
    );

    created_count := created_count + 1;
    occurrence_date := occurrence_date + 7;
  end loop;

  return created_count;
end;
$$;

revoke all on function public.create_weekly_class_sessions(uuid, integer, date, date, time, time, integer, boolean) from public, anon;
grant execute on function public.create_weekly_class_sessions(uuid, integer, date, date, time, time, integer, boolean) to authenticated;
