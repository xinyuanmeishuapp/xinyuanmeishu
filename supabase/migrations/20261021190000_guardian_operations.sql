alter table public.households
  add column if not exists review_status text not null default 'approved';
alter table public.households
  add column if not exists privacy_consent_at timestamptz;

do $$
begin
  alter table public.households
    add constraint households_review_status_check
    check (review_status in ('pending', 'approved', 'rejected'));
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.lesson_package_plans (
  lesson_count integer primary key check (lesson_count in (5, 10)),
  price integer check (price is null or price >= 0),
  validity_days integer check (validity_days is null or validity_days between 1 and 3650),
  is_available boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.lesson_package_plans (lesson_count)
values (5), (10)
on conflict (lesson_count) do nothing;

create table if not exists public.package_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete restrict,
  lesson_count integer not null references public.lesson_package_plans (lesson_count),
  payment_method public.payment_method not null,
  transfer_last_five text check (transfer_last_five is null or transfer_last_five ~ '^[0-9]{5}$'),
  status text not null default 'pending' check (status in ('pending', 'paid', 'rejected')),
  package_id uuid unique references public.lesson_packages (id) on delete restrict,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (payment_method = 'transfer' and transfer_last_five is not null)
    or (payment_method <> 'transfer' and transfer_last_five is null)
  )
);

create unique index if not exists package_requests_one_pending_per_household_idx
  on public.package_requests (household_id)
  where status = 'pending';

create index if not exists package_requests_status_created_idx
  on public.package_requests (status, created_at desc);

insert into public.lesson_transactions (package_id, transaction_type, lesson_delta, note)
select p.id, 'purchase', p.total_lessons, 'Opening balance migration'
from public.lesson_packages p
where p.payment_status = 'paid'
  and not exists (
    select 1 from public.lesson_transactions t
    where t.package_id = p.id
      and t.transaction_type = 'purchase'
  );

create table if not exists public.booking_policy (
  singleton boolean primary key default true check (singleton),
  cancellation_cutoff_hours integer not null default 0
    check (cancellation_cutoff_hours between 0 and 336),
  updated_at timestamptz not null default now()
);

insert into public.booking_policy (singleton)
values (true)
on conflict (singleton) do nothing;

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
  where id = target_student_id;

  if target_household_id is null
    or (not public.is_admin() and not public.is_household_member(target_household_id)) then
    raise exception 'Not authorized to book for this student';
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

create or replace function public.submit_guardian_registration(
  guardian_name text,
  students jsonb,
  accept_privacy boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  registration_household_id uuid;
  existing_household_id uuid;
  student jsonb;
  student_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if guardian_name is null or length(btrim(guardian_name)) not between 1 and 120
    or students is null or jsonb_typeof(students) is distinct from 'array'
    or accept_privacy is distinct from true then
    raise exception 'Invalid registration details';
  end if;

  student_count := jsonb_array_length(students);
  if student_count < 1 or student_count > 8 then
    raise exception 'Registration must include between 1 and 8 students';
  end if;

  if exists (
    select 1
    from public.household_members hm
    join public.households h on h.id = hm.household_id
    where hm.user_id = current_user_id
      and h.review_status <> 'rejected'
  ) then
    raise exception 'A household registration already exists';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(students) as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or length(btrim(coalesce(item.value ->> 'child_name', ''))) not between 1 and 120
      or length(btrim(coalesce(item.value ->> 'school', ''))) not between 1 and 160
      or length(btrim(coalesce(item.value ->> 'grade', ''))) not between 1 and 80
      or length(btrim(coalesce(item.value ->> 'home_address', ''))) not between 1 and 500
      or length(btrim(coalesce(item.value ->> 'emergency_phone', ''))) not between 7 and 40
  ) then
    raise exception 'Invalid student details';
  end if;

  select h.id into existing_household_id
  from public.households h
  join public.household_members hm on hm.household_id = h.id
  where hm.user_id = current_user_id
    and h.review_status = 'rejected'
  order by h.created_at desc
  limit 1
  for update of h;

  if existing_household_id is null then
    insert into public.households (name, review_status, privacy_consent_at)
    values (btrim(guardian_name), 'pending', now())
    returning id into registration_household_id;

    insert into public.household_members (household_id, user_id)
    values (registration_household_id, current_user_id);
  else
    registration_household_id := existing_household_id;
    update public.households
    set name = btrim(guardian_name), review_status = 'pending', privacy_consent_at = now()
    where id = registration_household_id;
    delete from public.students s where s.household_id = registration_household_id;
  end if;

  insert into public.students (
    household_id, child_name, school, grade, home_address, guardian_name, emergency_phone
  )
  select
    registration_household_id,
    btrim(item.value ->> 'child_name'),
    btrim(item.value ->> 'school'),
    btrim(item.value ->> 'grade'),
    btrim(item.value ->> 'home_address'),
    btrim(guardian_name),
    btrim(item.value ->> 'emergency_phone')
  from jsonb_array_elements(students) as item(value);

  update public.profiles
  set display_name = btrim(guardian_name)
  where id = current_user_id;

  return registration_household_id;
end;
$$;

create or replace function public.review_guardian_registration(
  target_household_id uuid,
  approve boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  update public.households
  set review_status = case when approve then 'approved' else 'rejected' end
  where id = target_household_id
    and review_status = 'pending';

  if not found then
    raise exception 'Pending household registration not found';
  end if;
end;
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

  if not exists (
    select 1
    from public.lesson_package_plans
    where lesson_count = target_lesson_count
      and is_available
      and price is not null
      and validity_days is not null
  ) then
    raise exception 'Package plan is not available';
  end if;

  insert into public.package_requests (
    household_id, lesson_count, payment_method, transfer_last_five
  )
  values (
    target_household_id, target_lesson_count, target_payment_method, target_transfer_last_five
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
  plan_record public.lesson_package_plans%rowtype;
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

  if not approve then
    update public.package_requests
    set status = 'rejected', reviewed_by = current_user_id, reviewed_at = now()
    where id = target_request_id;
    return;
  end if;

  select * into plan_record
  from public.lesson_package_plans
  where lesson_count = request_record.lesson_count
    and is_available
    and price is not null
    and validity_days is not null
  for update;

  if not found then
    raise exception 'Package plan must have a price and validity duration';
  end if;

  insert into public.lesson_packages (
    household_id, total_lessons, expires_on, payment_method,
    transfer_last_five, payment_status, amount_paid
  )
  values (
    request_record.household_id,
    request_record.lesson_count,
    (now() at time zone 'Asia/Taipei')::date + plan_record.validity_days,
    request_record.payment_method,
    request_record.transfer_last_five,
    'paid',
    plan_record.price
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

create or replace function public.cancel_class_booking(target_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  booking_record public.bookings%rowtype;
  session_starts_at timestamptz;
  cancellation_cutoff integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select * into booking_record
  from public.bookings
  where id = target_booking_id
  for update;

  if not found then
    raise exception 'Booking not found';
  end if;

  if not public.is_admin()
    and not public.is_household_member(booking_record.household_id) then
    raise exception 'Not authorized to cancel this booking';
  end if;

  if booking_record.status <> 'confirmed' then
    raise exception 'Booking is not active';
  end if;

  select starts_at into session_starts_at
  from public.class_sessions
  where id = booking_record.session_id;

  if session_starts_at <= now() then
    raise exception 'Past or started sessions cannot be cancelled online';
  end if;

  select cancellation_cutoff_hours into cancellation_cutoff
  from public.booking_policy
  where singleton;

  update public.bookings
  set status = 'cancelled',
      cancelled_at = now()
  where id = target_booking_id;

  if booking_record.lesson_cost > 0
    and session_starts_at > now() + make_interval(hours => cancellation_cutoff) then
    insert into public.lesson_transactions (
      package_id, booking_id, transaction_type, lesson_delta, note, created_by
    )
    values (
      booking_record.package_id, target_booking_id, 'cancellation',
      booking_record.lesson_cost, 'Class session cancellation within refund window', current_user_id
    );
  end if;
end;
$$;

alter table public.lesson_package_plans enable row level security;
alter table public.package_requests enable row level security;
alter table public.booking_policy enable row level security;

revoke all on public.lesson_package_plans, public.package_requests, public.booking_policy
  from anon, authenticated;
grant select on public.lesson_package_plans, public.package_requests, public.booking_policy
  to authenticated;
grant update (
  child_name, school, grade, home_address, guardian_name, emergency_phone
) on public.students to authenticated;
grant update (price, validity_days, is_available, updated_at)
  on public.lesson_package_plans to authenticated;
grant update (cancellation_cutoff_hours, updated_at)
  on public.booking_policy to authenticated;

drop policy if exists "Guardians can read configured package plans" on public.lesson_package_plans;
drop policy if exists "Admins can manage package plans" on public.lesson_package_plans;
drop policy if exists "Guardians and admins can read package requests" on public.package_requests;
drop policy if exists "Admins can read booking policy" on public.booking_policy;
drop policy if exists "Authenticated users can read cancellation cutoff" on public.booking_policy;
drop policy if exists "Admins can update booking policy" on public.booking_policy;
drop policy if exists "Admins can read all households" on public.households;
drop policy if exists "Admins can read all package requests" on public.package_requests;
drop policy if exists "Admins can read all household memberships" on public.household_members;
drop policy if exists "Admins can read all students" on public.students;
drop policy if exists "Admins can update student records" on public.students;

create policy "Guardians can read configured package plans"
  on public.lesson_package_plans for select to authenticated
  using (is_available or (select public.is_admin()));

create policy "Admins can manage package plans"
  on public.lesson_package_plans for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Guardians and admins can read package requests"
  on public.package_requests for select to authenticated
  using (public.is_household_member(household_id) or (select public.is_admin()));

create policy "Admins can read booking policy"
  on public.booking_policy for select to authenticated
  using ((select public.is_admin()));

create policy "Authenticated users can read cancellation cutoff"
  on public.booking_policy for select to authenticated
  using (true);

create policy "Admins can update booking policy"
  on public.booking_policy for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins can read all households"
  on public.households for select to authenticated
  using ((select public.is_admin()));

create policy "Admins can read all package requests"
  on public.package_requests for select to authenticated
  using ((select public.is_admin()));

create policy "Admins can read all household memberships"
  on public.household_members for select to authenticated
  using ((select public.is_admin()));

create policy "Admins can read all students"
  on public.students for select to authenticated
  using ((select public.is_admin()));

create policy "Admins can update student records"
  on public.students for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke all on function public.submit_guardian_registration(text, jsonb, boolean) from public, anon;
revoke all on function public.review_guardian_registration(uuid, boolean) from public, anon;
revoke all on function public.submit_package_request(integer, public.payment_method, text) from public, anon;
revoke all on function public.review_package_request(uuid, boolean) from public, anon;
revoke all on function public.cancel_class_booking(uuid) from public, anon;
grant execute on function public.cancel_class_booking(uuid) to authenticated;
grant execute on function public.submit_guardian_registration(text, jsonb, boolean) to authenticated;
grant execute on function public.review_guardian_registration(uuid, boolean) to authenticated;
grant execute on function public.submit_package_request(integer, public.payment_method, text) to authenticated;
grant execute on function public.review_package_request(uuid, boolean) to authenticated;

create or replace function public.get_public_session_availability()
returns table (
  session_id uuid,
  course_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity integer,
  reserved_count bigint
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
    s.capacity,
    count(b.id) filter (where b.status = 'confirmed')
  from public.class_sessions s
  join public.courses c on c.id = s.course_id and c.is_published
  left join public.bookings b on b.session_id = s.id
  where s.is_published and s.starts_at > now()
  group by s.id
  order by s.starts_at;
$$;

revoke all on function public.get_public_session_availability() from public;
grant execute on function public.get_public_session_availability() to anon, authenticated;

create or replace function public.save_lesson_package_plans(plans jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  if plans is null or jsonb_typeof(plans) is distinct from 'array' then
    raise exception 'Exactly two package plans are required';
  end if;

  if jsonb_array_length(plans) <> 2 then
    raise exception 'Exactly two package plans are required';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(plans) as item(
      lesson_count integer,
      price integer,
      validity_days integer,
      is_available boolean
    )
    where item.lesson_count not in (5, 10)
      or item.price < 0
      or (item.validity_days is not null and item.validity_days not between 1 and 3650)
      or item.is_available is null
      or (item.is_available and (item.price is null or item.validity_days is null))
  ) or (
    select count(distinct item.lesson_count) <> 2
    from jsonb_to_recordset(plans) as item(
      lesson_count integer,
      price integer,
      validity_days integer,
      is_available boolean
    )
  ) then
    raise exception 'Invalid package plan settings';
  end if;

  update public.lesson_package_plans target
  set price = item.price,
      validity_days = item.validity_days,
      is_available = item.is_available,
      updated_at = now()
  from jsonb_to_recordset(plans) as item(
    lesson_count integer,
    price integer,
    validity_days integer,
    is_available boolean
  )
  where target.lesson_count = item.lesson_count;
end;
$$;

revoke all on function public.save_lesson_package_plans(jsonb) from public, anon;
grant execute on function public.save_lesson_package_plans(jsonb) to authenticated;
