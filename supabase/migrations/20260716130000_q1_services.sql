-- Q1: named, priced services. A tutor can offer e.g. "Diagnostic assessment"
-- at a custom flat price instead of their standard hourly rate. Sessions
-- (and, for forward-compat with the Q2 booking-link work, bookings) can
-- optionally reference a service; when they do, the line amount uses the
-- service's flat price_cents instead of duration * effective_rate_cents.
-- Travel still bills additively on top when the client's travel rule says so
-- — a service replaces the "session portion" of the line amount, not travel.
--
-- services is mostly a plain rate-holding table like `clients` — a
-- service's price is snapshotted onto sessions.service_price_cents at
-- creation time (same "snapshot at log time" rule as effective_rate_cents),
-- so editing/deactivating a service never rewrites billing history, and
-- direct-client RLS is fine for insert/update, same as clients. Delete is
-- the one exception: the sessions/bookings FKs are `on delete set null`,
-- so a delete can silently strip service pricing off a *pending* (not yet
-- approved) booking or erase historical attribution — see delete_service()
-- below, the sole sanctioned delete path (no direct-delete RLS policy).

create table services (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutors (id) on delete cascade,
  name text not null,
  description text,
  duration_minutes integer not null check (duration_minutes > 0),
  price_cents integer not null check (price_cents >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index services_tutor_id_idx on services (tutor_id);

alter table services enable row level security;

create policy "services_select_own" on services
  for select using (tutor_id in (select id from tutors where auth_user_id = auth.uid()));

create policy "services_insert_own" on services
  for insert with check (tutor_id in (select id from tutors where auth_user_id = auth.uid()));

create policy "services_update_own" on services
  for update using (
    tutor_id in (select id from tutors where auth_user_id = auth.uid())
  ) with check (
    tutor_id in (select id from tutors where auth_user_id = auth.uid())
  );

-- No delete policy: delete_service() (below) is the only sanctioned delete.

-- Seed two defaults per existing tutor: "Tutoring session" mirrors their
-- current standard hourly rate for a typical 60-minute session (informational
-- starting point — sessions aren't required to use it, the hourly rate math
-- still applies whenever no service is picked), and "Diagnostic assessment"
-- at a flat starter price the tutor can edit.
insert into services (tutor_id, name, description, duration_minutes, price_cents, is_active)
select id, 'Tutoring session', 'Standard 1-hour session at your hourly rate.', 60, standard_rate_cents, true
from tutors;

insert into services (tutor_id, name, description, duration_minutes, price_cents, is_active)
select id, 'Diagnostic assessment', 'One-time assessment, priced separately from regular sessions.', 60, 7500, true
from tutors;

alter table sessions
  add column service_id uuid references services (id) on delete set null,
  -- Snapshot of services.price_cents at the moment the session was logged
  -- against that service — same rationale as effective_rate_cents: a later
  -- price edit on the service must never silently rewrite a past session's
  -- bill. Null means "no service, use the hourly rate math."
  add column service_price_cents integer;

alter table bookings
  add column service_id uuid references services (id) on delete set null;

-- session_amount_cents gains a trailing p_service_price_cents param. Adding
-- a parameter changes the function's argument-type signature, so this isn't
-- a true CREATE OR REPLACE (Postgres would create a second overload instead
-- of replacing the original) — drop the old 5-arg version first. Safe to do
-- ahead of updating its two plpgsql callers below: plpgsql function bodies
-- aren't statically bound to their callees' signatures, only resolved at
-- execution time, and both callers are being replaced in this same
-- transaction before anything can call them again.
drop function if exists session_amount_cents(integer, integer, integer, boolean, integer);

create function session_amount_cents(
  p_duration_minutes integer,
  p_travel_minutes integer,
  p_effective_rate_cents integer,
  p_bill_travel boolean,
  p_travel_rate_cents integer,
  p_service_price_cents integer default null
)
returns integer
language sql
security invoker
set search_path = public
immutable
as $$
  select round(
    coalesce(p_service_price_cents::numeric, (p_duration_minutes::numeric / 60) * p_effective_rate_cents)
    + case when p_bill_travel then (p_travel_minutes::numeric / 60) * coalesce(p_travel_rate_cents, 0) else 0 end
  )::integer
$$;

create or replace function create_draft_invoice(
  p_client_id uuid,
  p_period_start date,
  p_period_end date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
  v_invoice_id uuid;
  v_session record;
  v_line_count integer := 0;
begin
  if v_tutor_id is null then
    raise exception 'Not a tutor.';
  end if;

  if not exists (select 1 from clients where id = p_client_id and tutor_id = v_tutor_id) then
    raise exception 'Student not found.';
  end if;

  insert into invoices (tutor_id, client_id, period_start, period_end, status)
  values (v_tutor_id, p_client_id, p_period_start, p_period_end, 'draft')
  returning id into v_invoice_id;

  for v_session in
    select * from sessions
    where tutor_id = v_tutor_id
      and client_id = p_client_id
      and invoice_id is null
      and status = 'logged'
      and occurred_on between p_period_start and p_period_end
    order by occurred_on
    for update
  loop
    insert into invoice_line_items (invoice_id, session_id, description, quantity_minutes, amount_cents)
    values (
      v_invoice_id,
      v_session.id,
      'Session on ' || to_char(v_session.occurred_on, 'Mon DD, YYYY')
        || case when v_session.travel_minutes > 0 and v_session.bill_travel
             then ' (' || v_session.duration_minutes || ' min + ' || v_session.travel_minutes || ' min travel)'
             else ' (' || v_session.duration_minutes || ' min)'
           end,
      v_session.duration_minutes + case when v_session.bill_travel then v_session.travel_minutes else 0 end,
      session_amount_cents(
        v_session.duration_minutes,
        v_session.travel_minutes,
        v_session.effective_rate_cents,
        v_session.bill_travel,
        v_session.travel_rate_cents,
        v_session.service_price_cents
      )
    );

    update sessions set invoice_id = v_invoice_id where id = v_session.id;
    v_line_count := v_line_count + 1;
  end loop;

  if v_line_count = 0 then
    delete from invoices where id = v_invoice_id;
    raise exception 'No unbilled sessions for that student in that date range.';
  end if;

  perform recompute_invoice_totals(v_invoice_id);

  return v_invoice_id;
end;
$$;

-- update_session: intentionally does NOT touch service_id/service_price_cents
-- — a service-priced session keeps its flat snapshot through edits, same as
-- effective_rate_cents keeps the rate-rule snapshot. Only the resync block's
-- two session_amount_cents calls change, to pass v_session.service_price_cents
-- through so a service-priced session's invoice line item stays flat-priced
-- after an edit instead of silently falling back to hourly math.
create or replace function update_session(
  p_session_id uuid,
  p_occurred_on date,
  p_start_time time,
  p_duration_minutes integer,
  p_travel_minutes integer,
  p_location text,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
  v_session sessions%rowtype;
  v_client clients%rowtype;
  v_tutor tutors%rowtype;
  v_effective_rate integer;
  v_bill_travel boolean;
  v_travel_rate integer;
  v_line_item_id uuid;
  v_amount_cents integer;
begin
  if v_tutor_id is null then
    raise exception 'Not authorized.';
  end if;

  select * into v_session from sessions where id = p_session_id and tutor_id = v_tutor_id for update;
  if v_session.id is null then
    raise exception 'Session not found.';
  end if;
  if v_session.status = 'billed' then
    raise exception 'This session is already billed and can''t be edited. Void the invoice first if it needs to change.';
  end if;
  if p_duration_minutes <= 0 then
    raise exception 'Duration must be more than 0 minutes.';
  end if;
  if p_travel_minutes < 0 then
    raise exception 'Travel minutes can''t be negative.';
  end if;

  -- A service-priced session bills service_price_cents flat regardless of
  -- duration (see session_amount_cents above) — but the invoice line
  -- item's description/quantity_minutes below is still derived from
  -- duration_minutes, so letting it drift would show e.g. "120 min" next
  -- to a price that was actually for a fixed-scope 60-minute service.
  -- Duration on a service-priced session is locked; travel/date/location/
  -- notes stay editable.
  if v_session.service_id is not null then
    p_duration_minutes := v_session.duration_minutes;
  end if;

  if v_session.invoice_id is not null then
    if not exists (
      select 1 from invoices
      where id = v_session.invoice_id and p_occurred_on between period_start and period_end
    ) then
      raise exception 'That date falls outside this session''s invoice period — remove it from the invoice first if it needs to move.';
    end if;
  end if;

  select * into v_client from clients where id = v_session.client_id;
  select * into v_tutor from tutors where id = v_tutor_id;

  v_effective_rate := case
    when v_client.rate_type = 'pro_bono' then 0
    when v_client.rate_type = 'standard' then v_tutor.standard_rate_cents
    else coalesce(v_client.custom_rate_cents, v_tutor.standard_rate_cents)
  end;
  v_bill_travel := coalesce(v_client.bill_travel, v_tutor.bill_travel_default);
  v_travel_rate := case
    when v_bill_travel then coalesce(v_client.travel_rate_cents, v_tutor.travel_rate_cents, v_effective_rate)
    else null
  end;

  update sessions
  set occurred_on = p_occurred_on,
      start_time = p_start_time,
      duration_minutes = p_duration_minutes,
      travel_minutes = p_travel_minutes,
      location = p_location,
      bill_travel = v_bill_travel,
      effective_rate_cents = v_effective_rate,
      travel_rate_cents = v_travel_rate,
      notes = p_notes
  where id = p_session_id;

  if v_session.invoice_id is not null then
    v_amount_cents := session_amount_cents(
      p_duration_minutes, p_travel_minutes, v_effective_rate, v_bill_travel, v_travel_rate, v_session.service_price_cents
    );

    select id into v_line_item_id from invoice_line_items
    where invoice_id = v_session.invoice_id and session_id = p_session_id;

    if v_line_item_id is not null then
      update invoice_line_items
      set amount_cents = v_amount_cents,
          description = 'Session on ' || to_char(p_occurred_on, 'Mon DD, YYYY')
            || case when p_travel_minutes > 0 and v_bill_travel
                 then ' (' || p_duration_minutes || ' min + ' || p_travel_minutes || ' min travel)'
                 else ' (' || p_duration_minutes || ' min)'
               end,
          quantity_minutes = p_duration_minutes + case when v_bill_travel then p_travel_minutes else 0 end
      where id = v_line_item_id;

      perform recompute_invoice_totals(v_session.invoice_id);
    end if;
  end if;
end;
$$;

-- create_session_for_booking gains a trailing p_service_id param — same
-- drop-then-create rationale as session_amount_cents above (adding a param
-- changes the signature). create_booking and approve_booking (both updated
-- below) are its only callers and are replaced in this same transaction.
drop function if exists create_session_for_booking(uuid, uuid, date, time, integer);

create function create_session_for_booking(
  p_tutor_id uuid,
  p_client_id uuid,
  p_occurred_on date,
  p_start_time time,
  p_duration_minutes integer,
  p_service_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client clients%rowtype;
  v_tutor tutors%rowtype;
  v_service services%rowtype;
  v_effective_rate integer;
  v_bill_travel boolean;
  v_travel_rate integer;
  v_session_id uuid;
begin
  if not (coalesce(p_tutor_id = current_tutor_id(), false) or is_parent_of_student(p_client_id)) then
    raise exception 'Not authorized to create a session for this tutor/client pair.';
  end if;

  select * into v_client from clients where id = p_client_id;
  select * into v_tutor from tutors where id = p_tutor_id;

  if p_service_id is not null then
    select * into v_service from services
    where id = p_service_id and tutor_id = p_tutor_id and is_active;
    if v_service.id is null then
      raise exception 'Service not found or no longer offered.';
    end if;
  end if;

  -- Deliberately session duration always = p_duration_minutes, never
  -- v_service.duration_minutes: the caller (create_booking/approve_booking)
  -- already validated availability and confirmed-booking overlap against
  -- p_duration_minutes. Substituting the service's own duration here would
  -- silently widen the session past what was checked for conflicts,
  -- letting a second booking get confirmed over the same real time window.
  v_effective_rate := case
    when v_client.rate_type = 'pro_bono' then 0
    when v_client.rate_type = 'standard' then v_tutor.standard_rate_cents
    else coalesce(v_client.custom_rate_cents, v_tutor.standard_rate_cents)
  end;

  v_bill_travel := coalesce(v_client.bill_travel, v_tutor.bill_travel_default);
  v_travel_rate := coalesce(v_client.travel_rate_cents, v_tutor.travel_rate_cents, v_effective_rate);

  insert into sessions (
    tutor_id, client_id, occurred_on, start_time, duration_minutes,
    travel_minutes, bill_travel, effective_rate_cents, travel_rate_cents, status,
    service_id, service_price_cents
  )
  values (
    p_tutor_id, p_client_id, p_occurred_on, p_start_time, p_duration_minutes,
    0, v_bill_travel, v_effective_rate, v_travel_rate, 'logged',
    p_service_id, v_service.price_cents
  )
  returning id into v_session_id;

  return v_session_id;
end;
$$;

-- create_booking gains a trailing p_service_id param — same drop-then-create
-- rationale as above.
drop function if exists create_booking(uuid, timestamptz, integer);

create function create_booking(
  p_student_id uuid,
  p_requested_start timestamptz,
  p_duration_minutes integer,
  p_service_id uuid default null
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

  if p_service_id is not null and not exists (
    select 1 from services where id = p_service_id and tutor_id = v_client.tutor_id and is_active
  ) then
    raise exception 'Service not found or no longer offered.';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_client.tutor_id::text)::bigint);

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

  if v_status = 'confirmed' and exists (
    select 1 from bookings b
    where b.tutor_id = v_client.tutor_id
      and b.status = 'confirmed'
      and (b.requested_start, b.requested_start + (b.duration_minutes || ' minutes')::interval)
          overlaps (p_requested_start, p_requested_start + (p_duration_minutes || ' minutes')::interval)
  ) then
    raise exception 'That slot was just booked by someone else — pick another time.';
  end if;

  insert into bookings (tutor_id, student_id, requested_start, duration_minutes, status, mode, service_id)
  values (
    v_client.tutor_id, p_student_id, p_requested_start, p_duration_minutes, v_status,
    v_client.scheduling_mode::booking_mode, p_service_id
  )
  returning id into v_booking_id;

  if v_status = 'confirmed' then
    v_session_id := create_session_for_booking(
      v_client.tutor_id, p_student_id, p_requested_start::date, p_requested_start::time, p_duration_minutes, p_service_id
    );
    update bookings set session_id = v_session_id where id = v_booking_id;
  end if;

  return v_booking_id;
end;
$$;

-- approve_booking: unchanged signature, but now threads the booking's own
-- service_id through to create_session_for_booking — otherwise a requested
-- booking made against a service would silently lose its flat pricing the
-- moment the tutor approved it.
create or replace function approve_booking(p_booking_id uuid)
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
  v_service_id uuid;
  v_session_id uuid;
begin
  if v_tutor_id is null then
    raise exception 'Not authorized.';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_tutor_id::text)::bigint);

  select student_id, requested_start, duration_minutes, service_id
    into v_student_id, v_requested_start, v_duration_minutes, v_service_id
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
    v_tutor_id, v_student_id, v_requested_start::date, v_requested_start::time, v_duration_minutes, v_service_id
  );

  update bookings set session_id = v_session_id where id = p_booking_id;
end;
$$;

-- delete_service is the sole sanctioned delete path for services — there is
-- no direct-delete RLS policy on the table at all (see the note above the
-- table definition). A straight RLS-only delete would let the FK's
-- `on delete set null` silently strip
-- service_id off every referencing row: a *pending* (requested, not yet
-- approved) booking would lose its flat pricing and fall back to the
-- client's hourly rate the moment it's confirmed, and historical
-- sessions/bookings would lose their service-name attribution even though
-- their price snapshot survives. Deactivating (is_active = false) is the
-- always-safe alternative offered when a service has any history.
create function delete_service(p_service_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
begin
  if v_tutor_id is null then
    raise exception 'Not authorized.';
  end if;

  if not exists (select 1 from services where id = p_service_id and tutor_id = v_tutor_id) then
    raise exception 'Service not found.';
  end if;

  if exists (select 1 from sessions where service_id = p_service_id)
     or exists (select 1 from bookings where service_id = p_service_id)
  then
    raise exception 'This service has sessions or bookings against it — deactivate it instead so its price and name stay attached to that history.';
  end if;

  delete from services where id = p_service_id and tutor_id = v_tutor_id;
end;
$$;

revoke execute on function delete_service(uuid) from public;
grant execute on function delete_service(uuid) to authenticated;

revoke execute on function session_amount_cents(integer, integer, integer, boolean, integer, integer) from public;
revoke execute on function create_draft_invoice(uuid, date, date) from public;
revoke execute on function update_session(uuid, date, time, integer, integer, text, text) from public;
revoke execute on function create_session_for_booking(uuid, uuid, date, time, integer, uuid) from public;
revoke execute on function create_booking(uuid, timestamptz, integer, uuid) from public;
revoke execute on function approve_booking(uuid) from public;

grant execute on function session_amount_cents(integer, integer, integer, boolean, integer, integer) to authenticated;
grant execute on function create_draft_invoice(uuid, date, date) to authenticated;
grant execute on function update_session(uuid, date, time, integer, integer, text, text) to authenticated;
grant execute on function create_session_for_booking(uuid, uuid, date, time, integer, uuid) to authenticated;
grant execute on function create_booking(uuid, timestamptz, integer, uuid) to authenticated;
grant execute on function approve_booking(uuid) to authenticated;
