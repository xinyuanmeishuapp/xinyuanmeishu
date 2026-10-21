create or replace function public.create_student_record(
  target_household_id uuid,
  target_child_name text,
  target_school text,
  target_grade text,
  target_home_address text,
  target_guardian_name text,
  target_emergency_phone text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  created_student_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_admin() then
    if not public.is_household_member(target_household_id) then
      raise exception 'Not authorized to add a student to this household';
    end if;
  end if;

  if target_child_name is null or length(btrim(target_child_name)) not between 1 and 120
    or target_school is null or length(btrim(target_school)) not between 1 and 160
    or target_grade is null or length(btrim(target_grade)) not between 1 and 80
    or target_home_address is null or length(btrim(target_home_address)) not between 1 and 500
    or target_guardian_name is null or length(btrim(target_guardian_name)) not between 1 and 120
    or target_emergency_phone is null or length(btrim(target_emergency_phone)) not between 7 and 40 then
    raise exception 'Invalid student details';
  end if;

  insert into public.students (
    household_id, child_name, school, grade, home_address, guardian_name, emergency_phone
  )
  values (
    target_household_id, btrim(target_child_name), btrim(target_school), btrim(target_grade),
    btrim(target_home_address), btrim(target_guardian_name), btrim(target_emergency_phone)
  )
  returning id into created_student_id;

  return created_student_id;
end;
$$;

create or replace function public.delete_student_record(target_student_id uuid)
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

  if exists (
    select 1 from public.bookings
    where student_id = target_student_id
  ) then
    raise exception using
      errcode = '23503',
      message = 'Student has booking history';
  end if;

  delete from public.students where id = target_student_id;
end;
$$;

revoke all on function public.create_student_record(uuid, text, text, text, text, text, text)
  from public, anon;
revoke all on function public.delete_student_record(uuid) from public, anon;
grant execute on function public.create_student_record(uuid, text, text, text, text, text, text)
  to authenticated;
grant execute on function public.delete_student_record(uuid) to authenticated;
