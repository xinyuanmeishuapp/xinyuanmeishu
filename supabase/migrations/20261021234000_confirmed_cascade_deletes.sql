drop function if exists public.delete_student_record(uuid);

create or replace function public.delete_student_record(
  target_student_id uuid,
  confirmation_phrase text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  student_household_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if confirmation_phrase is distinct from '確認刪除' then
    raise exception 'Deletion confirmation phrase is invalid';
  end if;

  select household_id into student_household_id
  from public.students
  where id = target_student_id
  for update;

  if not found then
    raise exception 'Student not found';
  end if;

  if not public.is_admin()
    and not public.is_household_member(student_household_id) then
    raise exception 'Not authorized to delete this student';
  end if;

  delete from public.lesson_transactions
  where booking_id in (
    select id from public.bookings where student_id = target_student_id
  );

  delete from public.bookings where student_id = target_student_id;
  delete from public.students where id = target_student_id;
end;
$$;

create or replace function public.delete_course_record(
  target_course_id uuid,
  confirmation_phrase text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  if confirmation_phrase is distinct from '確認刪除' then
    raise exception 'Deletion confirmation phrase is invalid';
  end if;

  perform 1 from public.courses where id = target_course_id for update;
  if not found then
    raise exception 'Course not found';
  end if;

  perform 1 from public.class_sessions
  where course_id = target_course_id
  order by id
  for update;

  delete from public.lesson_transactions
  where booking_id in (
    select b.id
    from public.bookings b
    join public.class_sessions s on s.id = b.session_id
    where s.course_id = target_course_id
  );

  delete from public.bookings
  where session_id in (
    select id from public.class_sessions where course_id = target_course_id
  );

  delete from public.class_sessions where course_id = target_course_id;
  delete from public.courses where id = target_course_id;
end;
$$;

revoke all on function public.delete_student_record(uuid, text) from public, anon;
revoke all on function public.delete_course_record(uuid, text) from public, anon;
grant execute on function public.delete_student_record(uuid, text) to authenticated;
grant execute on function public.delete_course_record(uuid, text) to authenticated;

revoke delete on public.courses from authenticated;
