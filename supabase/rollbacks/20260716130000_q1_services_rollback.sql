-- Rollback for 20260716130000_q1_services.sql — restores every touched
-- function to its pre-Q1 body/signature, then drops the new columns/table.

revoke execute on function delete_service(uuid) from authenticated;
drop function if exists delete_service(uuid);

revoke execute on function approve_booking(uuid) from authenticated;
revoke execute on function create_booking(uuid, timestamptz, integer, uuid) from authenticated;
revoke execute on function create_session_for_booking(uuid, uuid, date, time, integer, uuid) from authenticated;
revoke execute on function update_session(uuid, date, time, integer, integer, text, text) from authenticated;
revoke execute on function create_draft_invoice(uuid, date, date) from authenticated;
revoke execute on function session_amount_cents(integer, integer, integer, boolean, integer, integer) from authenticated;

drop function if exists create_booking(uuid, timestamptz, integer, uuid);
drop function if exists create_session_for_booking(uuid, uuid, date, time, integer, uuid);
drop function if exists session_amount_cents(integer, integer, integer, boolean, integer, integer);

create function session_amount_cents(
  p_duration_minutes integer,
  p_travel_minutes integer,
  p_effective_rate_cents integer,
  p_bill_travel boolean,
  p_travel_rate_cents integer
)
returns integer
language sql
security invoker
set search_path = public
immutable
as $$
  select round(
    (p_duration_minutes::numeric / 60) * p_effective_rate_cents
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
        v_session.travel_rate_cents
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
      p_duration_minutes, p_travel_minutes, v_effective_rate, v_bill_travel, v_travel_rate
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
  v_session_id uuid;
begin
  if v_tutor_id is null then
    raise exception 'Not authorized.';
  end if;

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

revoke execute on function create_session_for_booking(uuid, uuid, date, time, integer) from public;
revoke execute on function create_booking(uuid, timestamptz, integer) from public;
grant execute on function create_session_for_booking(uuid, uuid, date, time, integer) to authenticated;
grant execute on function create_booking(uuid, timestamptz, integer) to authenticated;

revoke execute on function session_amount_cents(integer, integer, integer, boolean, integer) from public;
revoke execute on function create_draft_invoice(uuid, date, date) from public;
revoke execute on function update_session(uuid, date, time, integer, integer, text, text) from public;
grant execute on function session_amount_cents(integer, integer, integer, boolean, integer) to authenticated;
grant execute on function create_draft_invoice(uuid, date, date) to authenticated;
grant execute on function update_session(uuid, date, time, integer, integer, text, text) to authenticated;

alter table bookings drop column if exists service_id;
alter table sessions
  drop column if exists service_price_cents,
  drop column if exists service_id;

drop policy if exists "services_delete_own" on services;
drop policy if exists "services_update_own" on services;
drop policy if exists "services_insert_own" on services;
drop policy if exists "services_select_own" on services;
drop table if exists services;
