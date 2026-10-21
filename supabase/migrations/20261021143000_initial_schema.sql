do $$
begin
  create type public.app_role as enum ('guardian', 'admin');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.payment_method as enum ('transfer', 'cash', 'linepay');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.payment_status as enum ('pending', 'paid', 'refunded');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.booking_status as enum ('confirmed', 'cancelled');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.lesson_transaction_type as enum ('purchase', 'booking', 'cancellation', 'adjustment');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  role public.app_role not null default 'guardian',
  created_at timestamptz not null default now()
);

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  relationship text not null default 'guardian',
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete restrict,
  child_name text not null,
  school text not null,
  grade text not null,
  home_address text not null,
  guardian_name text not null,
  emergency_phone text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.lesson_packages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete restrict,
  total_lessons integer not null check (total_lessons > 0),
  expires_on date not null,
  payment_method public.payment_method not null,
  transfer_last_five text check (transfer_last_five is null or transfer_last_five ~ '^[0-9]{5}$'),
  payment_status public.payment_status not null default 'pending',
  amount_paid integer not null default 0 check (amount_paid >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('kids', 'adults', 'holiday')),
  title text not null,
  description text not null default '',
  age_range text not null default '',
  lesson_cost integer not null default 1 check (lesson_cost >= 0),
  extra_fee integer not null default 0 check (extra_fee >= 0),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null check (capacity > 0),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete restrict,
  student_id uuid not null references public.students (id) on delete restrict,
  package_id uuid not null references public.lesson_packages (id) on delete restrict,
  session_id uuid not null references public.class_sessions (id) on delete restrict,
  lesson_cost integer not null check (lesson_cost >= 0),
  extra_fee integer not null check (extra_fee >= 0),
  status public.booking_status not null default 'confirmed',
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);

create table if not exists public.lesson_transactions (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.lesson_packages (id) on delete restrict,
  booking_id uuid references public.bookings (id) on delete restrict,
  transaction_type public.lesson_transaction_type not null,
  lesson_delta integer not null check (lesson_delta <> 0),
  note text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null,
  body text not null,
  published_at timestamptz,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists household_members_user_id_idx on public.household_members (user_id);
create index if not exists students_household_id_idx on public.students (household_id);
create index if not exists lesson_packages_household_expires_idx on public.lesson_packages (household_id, expires_on);
create index if not exists class_sessions_course_starts_idx on public.class_sessions (course_id, starts_at);
create index if not exists bookings_household_created_idx on public.bookings (household_id, created_at desc);
create index if not exists bookings_session_status_idx on public.bookings (session_id, status);
create index if not exists lesson_transactions_package_created_idx on public.lesson_transactions (package_id, created_at);
create index if not exists announcements_published_idx on public.announcements (published_at desc) where is_published;
create unique index if not exists bookings_one_active_session_per_student_idx
  on public.bookings (student_id, session_id)
  where status = 'confirmed';

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = target_household_id
      and user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;
revoke all on function public.is_household_member(uuid) from public, anon;
grant execute on function public.is_household_member(uuid) to authenticated;

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
    and expires_on >= current_date
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

  update public.bookings
  set status = 'cancelled',
      cancelled_at = now()
  where id = target_booking_id;

  if booking_record.lesson_cost > 0 then
    insert into public.lesson_transactions (
      package_id, booking_id, transaction_type, lesson_delta, note, created_by
    )
    values (
      booking_record.package_id, target_booking_id, 'cancellation',
      booking_record.lesson_cost, 'Class session cancellation', current_user_id
    );
  end if;
end;
$$;

revoke all on function public.reserve_class_session(uuid, uuid, uuid) from public, anon;
revoke all on function public.cancel_class_booking(uuid) from public, anon;
grant execute on function public.reserve_class_session(uuid, uuid, uuid) to authenticated;
grant execute on function public.cancel_class_booking(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.students enable row level security;
alter table public.lesson_packages enable row level security;
alter table public.courses enable row level security;
alter table public.class_sessions enable row level security;
alter table public.bookings enable row level security;
alter table public.lesson_transactions enable row level security;
alter table public.announcements enable row level security;

revoke all on public.profiles, public.households, public.household_members,
  public.students, public.lesson_packages, public.courses, public.class_sessions,
  public.bookings, public.lesson_transactions, public.announcements
from anon, authenticated;

grant select on public.courses, public.class_sessions, public.announcements to anon, authenticated;
grant select on public.profiles, public.households, public.household_members,
  public.students, public.lesson_packages, public.bookings, public.lesson_transactions to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant insert, update, delete on public.courses, public.class_sessions, public.announcements to authenticated;

create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "Users can update their display name"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Household members can read their households"
  on public.households for select to authenticated
  using (public.is_household_member(id) or (select public.is_admin()));

create policy "Household members can read household membership"
  on public.household_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_household_member(household_id) or (select public.is_admin()));

create policy "Household members and admins can read students"
  on public.students for select to authenticated
  using (public.is_household_member(household_id) or (select public.is_admin()));

create policy "Household members and admins can read lesson packages"
  on public.lesson_packages for select to authenticated
  using (public.is_household_member(household_id) or (select public.is_admin()));

create policy "Published courses are visible to visitors"
  on public.courses for select to anon, authenticated
  using (is_published or (select public.is_admin()));

create policy "Published future sessions are visible to visitors"
  on public.class_sessions for select to anon, authenticated
  using (
    (is_published and starts_at > now()
      and exists (
        select 1 from public.courses
        where courses.id = class_sessions.course_id
          and courses.is_published
      ))
    or (select public.is_admin())
  );

create policy "Household members and admins can read bookings"
  on public.bookings for select to authenticated
  using (public.is_household_member(household_id) or (select public.is_admin()));

create policy "Household members and admins can read lesson transactions"
  on public.lesson_transactions for select to authenticated
  using (
    exists (
      select 1
      from public.lesson_packages
      where lesson_packages.id = lesson_transactions.package_id
        and public.is_household_member(lesson_packages.household_id)
    )
    or (select public.is_admin())
  );

create policy "Published announcements are visible to visitors"
  on public.announcements for select to anon, authenticated
  using (
    (is_published and published_at <= now())
    or (select public.is_admin())
  );

create policy "Admins can manage courses"
  on public.courses for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins can manage class sessions"
  on public.class_sessions for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins can manage announcements"
  on public.announcements for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
