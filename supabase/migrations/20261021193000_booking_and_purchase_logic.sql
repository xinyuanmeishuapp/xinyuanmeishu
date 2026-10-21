alter table public.package_requests
  add column if not exists quoted_price integer,
  add column if not exists validity_days_snapshot integer;

update public.package_requests request
set quoted_price = lp.amount_paid,
    validity_days_snapshot = greatest(
      1,
      lp.expires_on - (request.reviewed_at at time zone 'Asia/Taipei')::date
    )
from public.lesson_packages lp
where request.package_id = lp.id
  and request.status = 'paid'
  and request.reviewed_at is not null
  and (request.quoted_price is null or request.validity_days_snapshot is null);

do $$
begin
  alter table public.package_requests
    add constraint package_requests_quoted_price_check
    check (quoted_price is null or quoted_price >= 0);
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table public.package_requests
    add constraint package_requests_validity_snapshot_check
    check (validity_days_snapshot is null or validity_days_snapshot between 1 and 3650);
exception
  when duplicate_object then null;
end
$$;

create or replace function public.submit_package_request(
  target_lesson_count integer,
  target_payment_method public.payment_method,
  target_transfer_last_five text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_household_id uuid;
  plan_record public.lesson_package_plans%rowtype;
  new_request_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select hm.household_id into target_household_id
  from public.household_members hm
  join public.households h on h.id = hm.household_id
  where hm.user_id = current_user_id
    and h.review_status = 'approved'
  limit 1;

  if target_household_id is null then
    raise exception 'An approved household is required';
  end if;

  if target_payment_method = 'transfer' then
    if target_transfer_last_five is null
      or target_transfer_last_five !~ '^[0-9]{5}$' then
      raise exception 'A valid last five digits is required for transfers';
    end if;
  elsif target_transfer_last_five is not null then
    raise exception 'Transfer digits are only accepted for transfers';
  end if;

  select * into plan_record
  from public.lesson_package_plans
  where lesson_count = target_lesson_count
    and is_available
    and price is not null
    and validity_days is not null
  for share;

  if not found then
    raise exception 'Package plan is not available';
  end if;

  insert into public.package_requests (
    household_id, lesson_count, payment_method, transfer_last_five,
    quoted_price, validity_days_snapshot
  )
  values (
    target_household_id,
    target_lesson_count,
    target_payment_method,
    target_transfer_last_five,
    plan_record.price,
    plan_record.validity_days
  )
  returning id into new_request_id;

  return new_request_id;
end;
$$;

create or replace function public.review_package_request(target_request_id uuid, approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  request_record public.package_requests%rowtype;
  new_package_id uuid;
begin
  if current_user_id is null or not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  select * into request_record
  from public.package_requests
  where id = target_request_id
  for update;

  if not found or request_record.status <> 'pending' then
    raise exception 'Pending package request not found';
  end if;

  if not exists (
    select 1 from public.households
    where id = request_record.household_id
      and review_status = 'approved'
  ) then
    raise exception 'Household registration is not approved';
  end if;

  if not approve then
    update public.package_requests
    set status = 'rejected', reviewed_by = current_user_id, reviewed_at = now()
    where id = target_request_id;
    return;
  end if;

  if request_record.quoted_price is null
    or request_record.validity_days_snapshot is null then
    raise exception 'Package request has no recorded quote; ask the guardian to submit a new request';
  end if;

  insert into public.lesson_packages (
    household_id, total_lessons, expires_on, payment_method,
    transfer_last_five, payment_status, amount_paid
  )
  values (
    request_record.household_id,
    request_record.lesson_count,
    (now() at time zone 'Asia/Taipei')::date + request_record.validity_days_snapshot,
    request_record.payment_method,
    request_record.transfer_last_five,
    'paid',
    request_record.quoted_price
  )
  returning id into new_package_id;

  insert into public.lesson_transactions (
    package_id, transaction_type, lesson_delta, note, created_by
  )
  values (
    new_package_id, 'purchase', request_record.lesson_count,
    'Package purchase payment confirmed', current_user_id
  );

  update public.package_requests
  set status = 'paid',
      package_id = new_package_id,
      reviewed_by = current_user_id,
      reviewed_at = now()
  where id = target_request_id;
end;
$$;

create or replace function public.reserve_class_session(
  target_student_id uuid,
  target_session_id uuid,
  target_package_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_household_id uuid;
  session_record public.class_sessions%rowtype;
  course_record public.courses%rowtype;
  package_record public.lesson_packages%rowtype;
  remaining_lessons bigint;
  reserved_count bigint;
  new_booking_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select household_id into target_household_id
  from public.students
  where id = target_student_id
  for update;

  if target_household_id is null
    or (not public.is_admin() and not public.is_household_member(target_household_id)) then
    raise exception 'Not authorized to book for this student';
  end if;

  if not public.is_admin() and not exists (
    select 1 from public.households
    where id = target_household_id and review_status = 'approved'
  ) then
    raise exception 'Household registration is not approved';
  end if;

  select * into session_record
  from public.class_sessions
  where id = target_session_id
    and is_published
    and starts_at > now()
  for update;

  if not found then
    raise exception 'Session is unavailable';
  end if;

  select * into course_record
  from public.courses
  where id = session_record.course_id
    and is_published;

  if not found then
    raise exception 'Course is unavailable';
  end if;

  select * into package_record
  from public.lesson_packages
  where id = target_package_id
    and household_id = target_household_id
    and expires_on >= (now() at time zone 'Asia/Taipei')::date
    and payment_status = 'paid'
  for update;

  if not found then
    raise exception 'No valid paid lesson package';
  end if;

  select coalesce(sum(lesson_delta), 0) into remaining_lessons
  from public.lesson_transactions
  where package_id = target_package_id;

  if remaining_lessons < course_record.lesson_cost then
    raise exception 'Insufficient remaining lessons';
  end if;

  select count(*) into reserved_count
  from public.bookings
  where session_id = target_session_id
    and status = 'confirmed';

  if reserved_count >= session_record.capacity then
    raise exception 'Session is full';
  end if;

  if exists (
    select 1
    from public.bookings
    where student_id = target_student_id
      and session_id = target_session_id
      and status = 'confirmed'
  ) then
    raise exception 'Student already has an active booking for this session';
  end if;

  if exists (
    select 1
    from public.bookings existing_booking
    join public.class_sessions existing_session on existing_session.id = existing_booking.session_id
    where existing_booking.student_id = target_student_id
      and existing_booking.status = 'confirmed'
      and existing_session.starts_at < session_record.ends_at
      and existing_session.ends_at > session_record.starts_at
  ) then
    raise exception 'Student already has an overlapping class booking';
  end if;

  insert into public.bookings (
    household_id, student_id, package_id, session_id,
    lesson_cost, extra_fee, created_by
  )
  values (
    target_household_id, target_student_id, target_package_id, target_session_id,
    course_record.lesson_cost, course_record.extra_fee, current_user_id
  )
  returning id into new_booking_id;

  if course_record.lesson_cost > 0 then
    insert into public.lesson_transactions (
      package_id, booking_id, transaction_type, lesson_delta, note, created_by
    )
    values (
      target_package_id, new_booking_id, 'booking', -course_record.lesson_cost,
      'Class session booking', current_user_id
    );
  end if;

  return new_booking_id;
end;
$$;

drop function if exists public.get_public_session_availability();

create function public.get_public_session_availability()
returns table (
  session_id uuid,
  course_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  is_full boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.course_id,
    s.starts_at,
    s.ends_at,
    count(b.id) filter (where b.status = 'confirmed') >= s.capacity
  from public.class_sessions s
  join public.courses c on c.id = s.course_id and c.is_published
  left join public.bookings b on b.session_id = s.id
  where s.is_published and s.starts_at > now()
  group by s.id
  order by s.starts_at;
$$;

create or replace function public.save_class_session(
  target_session_id uuid,
  target_course_id uuid,
  target_starts_at timestamptz,
  target_ends_at timestamptz,
  target_capacity integer,
  target_is_published boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  existing_session public.class_sessions%rowtype;
  confirmed_bookings bigint;
  saved_session_id uuid;
begin
  if current_user_id is null or not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  if target_course_id is null
    or target_starts_at is null
    or target_ends_at is null
    or target_ends_at <= target_starts_at
    or target_capacity is null
    or target_capacity < 1
    or target_capacity > 500
    or target_is_published is null then
    raise exception 'Invalid class session details';
  end if;

  if target_is_published and not exists (
    select 1 from public.courses
    where id = target_course_id and is_published
  ) then
    raise exception 'Cannot publish a session for an unpublished course';
  end if;

  if target_session_id is null then
    insert into public.class_sessions (
      course_id, starts_at, ends_at, capacity, is_published
    )
    values (
      target_course_id, target_starts_at, target_ends_at,
      target_capacity, target_is_published
    )
    returning id into saved_session_id;
    return saved_session_id;
  end if;

  select * into existing_session
  from public.class_sessions
  where id = target_session_id
  for update;

  if not found then
    raise exception 'Class session not found';
  end if;

  select count(*) into confirmed_bookings
  from public.bookings
  where session_id = target_session_id and status = 'confirmed';

  if target_capacity < confirmed_bookings then
    raise exception 'Capacity cannot be lower than confirmed bookings';
  end if;

  if confirmed_bookings > 0 and (
    target_course_id <> existing_session.course_id
    or target_starts_at <> existing_session.starts_at
    or target_ends_at <> existing_session.ends_at
  ) then
    raise exception 'Cannot change course or time while active bookings exist';
  end if;

  update public.class_sessions
  set course_id = target_course_id,
      starts_at = target_starts_at,
      ends_at = target_ends_at,
      capacity = target_capacity,
      is_published = target_is_published
  where id = target_session_id
  returning id into saved_session_id;

  return saved_session_id;
end;
$$;

revoke all on function public.submit_package_request(integer, public.payment_method, text) from public, anon;
revoke all on function public.review_package_request(uuid, boolean) from public, anon;
revoke all on function public.reserve_class_session(uuid, uuid, uuid) from public, anon;
revoke all on function public.get_public_session_availability() from public;
revoke all on function public.save_class_session(uuid, uuid, timestamptz, timestamptz, integer, boolean) from public, anon;
grant execute on function public.submit_package_request(integer, public.payment_method, text) to authenticated;
grant execute on function public.review_package_request(uuid, boolean) to authenticated;
grant execute on function public.reserve_class_session(uuid, uuid, uuid) to authenticated;
grant execute on function public.get_public_session_availability() to anon, authenticated;
grant execute on function public.save_class_session(uuid, uuid, timestamptz, timestamptz, integer, boolean) to authenticated;
