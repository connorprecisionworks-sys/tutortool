-- P9: tutor availability + per-student scheduling mode (request / calendar /
-- message) + bookings that become sessions on confirmation.
--
-- TODO(connor): availability is modeled as recurring weekly windows
-- (weekday + start_time/end_time), not the "explicit start_ts/end_ts"
-- alternative section 12 also allows — simpler to build and reason about
-- for a small tutoring practice, and covers the common case (same open
-- hours every week). Add one-off exception windows later if needed.
--
-- Same money_mutation_architecture pattern as P3-P7: bookings has no
-- direct-client write RLS policy. create_booking / approve_booking /
-- decline_booking are the sole write path, each re-deriving its own auth.
-- decline_booking's status transition is a single atomic guarded UPDATE
-- (not a SELECT-then-UPDATE) so a concurrent call on the same booking
-- can't race past a stale check — the exact bug class the P6/P7 reviews
-- caught twice already in this build (redeem_invite,
-- session_notes_update_own). create_booking/approve_booking need a
-- stronger guard than a single-row UPDATE can express (checking for
-- *overlap* against OTHER rows, not just a status match on one row), so
-- they instead take a per-tutor pg_advisory_xact_lock before reading —
-- the lock, not the statement shape, is what makes their SELECT-then-
-- UPDATE safe under concurrency.

alter table clients
  add column scheduling_mode text not null default 'message'
  check (scheduling_mode in ('request', 'calendar', 'message'));

create table availability (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutors (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  constraint availability_time_order check (end_time > start_time)
);

create index availability_tutor_id_idx on availability (tutor_id);

alter table availability enable row level security;

create policy "availability_select_own" on availability
  for select using (tutor_id in (select id from tutors where auth_user_id = auth.uid()));

create policy "availability_select_parent" on availability
  for select using (
    exists (
      select 1 from clients c
      where c.tutor_id = availability.tutor_id and is_parent_of_student(c.id)
    )
  );

create policy "availability_insert_own" on availability
  for insert with check (tutor_id in (select id from tutors where auth_user_id = auth.uid()));

create policy "availability_delete_own" on availability
  for delete using (tutor_id in (select id from tutors where auth_user_id = auth.uid()));

-- No update policy: availability windows are delete + re-add, not edited
-- in place — matches resources' immutability approach from P8.

create type booking_status as enum ('requested', 'confirmed', 'declined', 'cancelled');
create type booking_mode as enum ('request', 'calendar', 'message');

create table bookings (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutors (id) on delete cascade,
  student_id uuid not null references clients (id) on delete cascade,
  requested_start timestamptz not null,
  duration_minutes integer not null check (duration_minutes > 0),
  status booking_status not null default 'requested',
  mode booking_mode not null,
  session_id uuid references sessions (id) on delete set null,
  created_at timestamptz not null default now()
);

create index bookings_tutor_id_idx on bookings (tutor_id);
create index bookings_student_id_idx on bookings (student_id);

alter table bookings enable row level security;

create policy "bookings_select_own" on bookings
  for select using (tutor_id in (select id from tutors where auth_user_id = auth.uid()));

create policy "bookings_select_parent" on bookings
  for select using (is_parent_of_student(student_id));

-- No insert/update/delete policy: create_booking() / approve_booking() /
-- decline_booking() are the only sanctioned writes.

-- Internal helper (always called from create_booking/approve_booking
-- within the same transaction) — but per this build's established rule
-- that EXECUTE grants are checked against the ORIGINAL calling role at
-- every level of a call chain, not just the top-level entry point (a
-- SECURITY DEFINER function's nested calls do NOT inherit the definer's
-- privileges for grant purposes here), this function is directly callable
-- via RPC by any authenticated user once granted EXECUTE below. It must
-- therefore re-derive its own authorization exactly like every other
-- write path in this build, rather than trusting that only
-- create_booking/approve_booking will ever call it: the caller must
-- either BE the tutor named by p_tutor_id, or be a parent linked to
-- p_client_id (the calendar-mode auto-confirm path, where create_booking
-- calls this on behalf of the requesting parent).
--
-- Snapshots the rate the same way P2's session-logging action does:
-- effective_rate_cents/bill_travel/travel_rate_cents resolved from the
-- client's current rate rule at confirmation time. travel_minutes starts
-- at 0 since neither a parent's request nor a calendar self-book captures
-- travel time — the tutor fills that in afterward via the normal session
-- edit page, which already re-resolves the rate on save.
create function create_session_for_booking(
  p_tutor_id uuid,
  p_client_id uuid,
  p_occurred_on date,
  p_start_time time,
  p_duration_minutes integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client clients%rowtype;
  v_tutor tutors%rowtype;
  v_effective_rate integer;
  v_bill_travel boolean;
  v_travel_rate integer;
  v_session_id uuid;
begin
  -- coalesce(..., false) matters here: current_tutor_id() is NULL for a
  -- parent caller, and `NULL = p_tutor_id` is NULL (not false) — without
  -- the coalesce, `not (NULL or is_parent_of_student(...))` would itself
  -- evaluate to NULL whenever is_parent_of_student(...) is false, and
  -- `if NULL then` is a no-op in plpgsql, silently skipping the exception
  -- for a parent who isn't actually linked to this student.
  if not (coalesce(p_tutor_id = current_tutor_id(), false) or is_parent_of_student(p_client_id)) then
    raise exception 'Not authorized to create a session for this tutor/client pair.';
  end if;

  select * into v_client from clients where id = p_client_id;
  select * into v_tutor from tutors where id = p_tutor_id;

  v_effective_rate := case
    when v_client.rate_type = 'pro_bono' then 0
    when v_client.rate_type = 'standard' then v_tutor.standard_rate_cents
    else coalesce(v_client.custom_rate_cents, v_tutor.standard_rate_cents)
  end;

  v_bill_travel := coalesce(v_client.bill_travel, v_tutor.bill_travel_default);
  v_travel_rate := coalesce(v_client.travel_rate_cents, v_tutor.travel_rate_cents, v_effective_rate);

  insert into sessions (
    tutor_id, client_id, occurred_on, start_time, duration_minutes,
    travel_minutes, bill_travel, effective_rate_cents, travel_rate_cents, status
  )
  values (
    p_tutor_id, p_client_id, p_occurred_on, p_start_time, p_duration_minutes,
    0, v_bill_travel, v_effective_rate, v_travel_rate, 'logged'
  )
  returning id into v_session_id;

  return v_session_id;
end;
$$;

create function create_booking(
  p_student_id uuid,
  p_requested_start timestamptz,
  p_duration_minutes integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_user_id uuid;
  v_client clients%rowtype;
  v_booking_id uuid;
  v_session_id uuid;
  v_status booking_status;
  v_weekday integer;
  v_start_seconds integer;
  v_end_seconds integer;
begin
  select id into v_parent_user_id from users where auth_user_id = auth.uid() and role = 'parent';
  if v_parent_user_id is null then
    raise exception 'Not a parent account.';
  end if;

  if not is_parent_of_student(p_student_id) then
    raise exception 'Not authorized for this student.';
  end if;

  if p_duration_minutes <= 0 then
    raise exception 'Duration must be positive.';
  end if;

  select * into v_client from clients where id = p_student_id;

  if v_client.scheduling_mode = 'message' then
    raise exception 'This tutor schedules sessions manually — reach out to them directly.';
  end if;

  -- Serialize every create_booking/approve_booking call for this tutor so
  -- the overlap check below (and, for calendar mode, the insert itself)
  -- can't race a concurrent call for the same tutor — two parents hitting
  -- "book" on the same slot within milliseconds of each other must not
  -- both walk away confirmed. Held for the rest of this transaction.
  perform pg_advisory_xact_lock(hashtext(v_client.tutor_id::text)::bigint);

  -- Enforce "parent requests a slot inside the tutor's availability"
  -- server-side, not just as a UI nicety — a request/calendar booking must
  -- fall entirely within one of the tutor's declared weekly windows.
  -- Worked in whole seconds-since-midnight rather than `time + interval`:
  -- Postgres `time` arithmetic wraps modulo 24h with no error, so a
  -- 23:30 start + 90 minutes would silently become 01:00 and pass an
  -- end-time check meant to keep bookings inside a single day. Rejecting
  -- anything that would cross midnight up front avoids the wrap entirely.
  v_weekday := extract(dow from p_requested_start);
  v_start_seconds := extract(epoch from p_requested_start::time)::integer;
  v_end_seconds := v_start_seconds + p_duration_minutes * 60;

  if v_end_seconds > 86400 then
    raise exception 'That booking would run past midnight, which isn''t supported yet.';
  end if;

  if not exists (
    select 1 from availability a
    where a.tutor_id = v_client.tutor_id
      and a.weekday = v_weekday
      and v_start_seconds >= extract(epoch from a.start_time)::integer
      and v_end_seconds <= extract(epoch from a.end_time)::integer
  ) then
    raise exception 'That time is outside the tutor''s availability.';
  end if;

  v_status := case when v_client.scheduling_mode = 'calendar' then 'confirmed' else 'requested' end;

  -- Only a confirmed (calendar auto-confirm) booking needs to be checked
  -- against other confirmed bookings — two overlapping *requests* are
  -- fine, since at most one of them can ever be approved (approve_booking
  -- runs the same overlap check before confirming).
  if v_status = 'confirmed' and exists (
    select 1 from bookings b
    where b.tutor_id = v_client.tutor_id
      and b.status = 'confirmed'
      and (b.requested_start, b.requested_start + (b.duration_minutes || ' minutes')::interval)
          overlaps (p_requested_start, p_requested_start + (p_duration_minutes || ' minutes')::interval)
  ) then
    raise exception 'That slot was just booked by someone else — pick another time.';
  end if;

  insert into bookings (tutor_id, student_id, requested_start, duration_minutes, status, mode)
  values (
    v_client.tutor_id, p_student_id, p_requested_start, p_duration_minutes, v_status,
    v_client.scheduling_mode::booking_mode
  )
  returning id into v_booking_id;

  if v_status = 'confirmed' then
    v_session_id := create_session_for_booking(
      v_client.tutor_id, p_student_id, p_requested_start::date, p_requested_start::time, p_duration_minutes
    );
    update bookings set session_id = v_session_id where id = v_booking_id;
  end if;

  return v_booking_id;
end;
$$;

create function approve_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
  v_student_id uuid;
  v_requested_start timestamptz;
  v_duration_minutes integer;
  v_session_id uuid;
begin
  if v_tutor_id is null then
    raise exception 'Not authorized.';
  end if;

  -- Same per-tutor serialization as create_booking, held for the rest of
  -- this transaction — with the lock held, no concurrent create_booking/
  -- approve_booking call for this tutor can interleave, which is what
  -- makes the plain SELECT-then-UPDATE below safe (the lock, not the
  -- statement shape, is what closes the race here).
  perform pg_advisory_xact_lock(hashtext(v_tutor_id::text)::bigint);

  select student_id, requested_start, duration_minutes
    into v_student_id, v_requested_start, v_duration_minutes
  from bookings
  where id = p_booking_id and tutor_id = v_tutor_id and status = 'requested';

  if v_student_id is null then
    raise exception 'Booking not found or not pending.';
  end if;

  if exists (
    select 1 from bookings b
    where b.tutor_id = v_tutor_id
      and b.status = 'confirmed'
      and b.id <> p_booking_id
      and (b.requested_start, b.requested_start + (b.duration_minutes || ' minutes')::interval)
          overlaps (v_requested_start, v_requested_start + (v_duration_minutes || ' minutes')::interval)
  ) then
    raise exception 'That slot conflicts with another confirmed booking — decline or reschedule one of them first.';
  end if;

  update bookings
  set status = 'confirmed'
  where id = p_booking_id and tutor_id = v_tutor_id and status = 'requested';

  v_session_id := create_session_for_booking(
    v_tutor_id, v_student_id, v_requested_start::date, v_requested_start::time, v_duration_minutes
  );

  update bookings set session_id = v_session_id where id = p_booking_id;
end;
$$;

create function decline_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update bookings
  set status = 'declined'
  where id = p_booking_id and tutor_id = current_tutor_id() and status = 'requested';

  if not found then
    raise exception 'Booking not found or not pending.';
  end if;
end;
$$;

revoke execute on function create_session_for_booking(uuid, uuid, date, time, integer) from public;
revoke execute on function create_booking(uuid, timestamptz, integer) from public;
revoke execute on function approve_booking(uuid) from public;
revoke execute on function decline_booking(uuid) from public;

grant execute on function create_session_for_booking(uuid, uuid, date, time, integer) to authenticated;
grant execute on function create_booking(uuid, timestamptz, integer) to authenticated;
grant execute on function approve_booking(uuid) to authenticated;
grant execute on function decline_booking(uuid) to authenticated;
