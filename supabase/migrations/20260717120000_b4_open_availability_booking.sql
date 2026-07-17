-- B4: standing self-serve booking — a second booking_links "mode" where a
-- parent picks ANY open time inside the tutor's weekly availability instead
-- of a tutor-curated fixed list (Q2). The link is "standing": unlike a
-- fixed_slots link (single-use, flips to 'booked' after one confirm), an
-- open_availability link stays 'open' and can be booked repeatedly by
-- different parents at different times, until the tutor cancels it —
-- matching the "Calendly-style" framing in the build-queue spec.
--
-- Real gap this closes (found while researching the existing system, not
-- assumed): confirm_booking_link (Q2) inserts straight into `sessions` with
-- NO overlap check against anything, and create_booking/approve_booking
-- (P9) only check overlap against OTHER `bookings` rows — the two
-- mechanisms can't see each other, so a tutor could already be
-- double-booked across a booking link and a P9 calendar-mode request today.
-- Since "pick any open time" is a much bigger double-booking surface than a
-- tutor-curated fixed list, is_slot_bookable() below checks BOTH `sessions`
-- and `bookings` (status='confirmed') under the same per-tutor
-- pg_advisory_xact_lock pattern P9's create_booking/approve_booking already
-- use for exactly this class of race.

alter table booking_links
  add column mode text not null default 'fixed_slots' check (mode in ('fixed_slots', 'open_availability')),
  -- Only used for open_availability links with no service_id (mirrors how
  -- create_booking_link already accepts p_duration_minutes as a service_id
  -- alternative for fixed_slots links — same "service XOR explicit
  -- duration" rule, just needs somewhere to live on the link itself since
  -- there's no booking_link_slots row to hang a duration off for this mode).
  add column duration_minutes integer,
  add column buffer_minutes integer not null default 0 check (buffer_minutes >= 0),
  add constraint booking_links_open_availability_duration_check
    check (mode <> 'open_availability' or service_id is not null or duration_minutes is not null);

-- Traceability only (which standing link a session came from, for the
-- tutor's own booking-links list) — not an ownership-invariant column like
-- package_id/recurring_session_id, so it doesn't need sessions_insert_own
-- tightened: every write to it goes through confirm_open_booking_link
-- (SECURITY DEFINER, bypasses RLS as its owner), never a direct client
-- insert with a form field for it, same as resources.session_id /
-- reminders.session_id elsewhere in this schema.
alter table sessions
  add column booking_link_id uuid references booking_links (id) on delete set null;

create index sessions_booking_link_id_idx on sessions (booking_link_id) where booking_link_id is not null;

-- Shared overlap + availability-containment check, used by both the public
-- day-slots lookup and the confirm function so there is exactly one
-- implementation of "is this tutor free at this time" to keep correct.
-- SECURITY DEFINER (not INVOKER) and explicitly granted to anon below —
-- this codebase's established rule (see money_mutation_architecture
-- memory) is that EXECUTE is checked against the original calling role
-- even for a helper only ever called transitively from within another
-- SECURITY DEFINER function.
create function is_slot_bookable(
  p_tutor_id uuid,
  p_start_ts timestamptz,
  p_duration_minutes integer,
  p_buffer_minutes integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_weekday integer;
  v_start_seconds integer;
  v_end_seconds integer;
  v_buffer interval;
begin
  if p_start_ts < now() then
    return false;
  end if;

  -- Same whole-seconds-since-midnight approach as create_booking (P9/Q1) —
  -- deliberately not `time + interval` arithmetic, which wraps mod-24h and
  -- would let a booking that runs past midnight silently pass a naive
  -- end-time check instead of being rejected.
  v_weekday := extract(dow from p_start_ts);
  v_start_seconds := extract(epoch from p_start_ts::time)::integer;
  v_end_seconds := v_start_seconds + p_duration_minutes * 60;

  if v_end_seconds > 86400 then
    return false;
  end if;

  if not exists (
    select 1 from availability a
    where a.tutor_id = p_tutor_id
      and a.weekday = v_weekday
      and v_start_seconds >= extract(epoch from a.start_time)::integer
      and v_end_seconds <= extract(epoch from a.end_time)::integer
  ) then
    return false;
  end if;

  v_buffer := (p_buffer_minutes || ' minutes')::interval;

  if exists (
    select 1 from sessions s
    where s.tutor_id = p_tutor_id
      and s.cancelled_at is null
      and (
        ((s.occurred_on::text || 'T' || coalesce(s.start_time::text, '00:00:00') || 'Z')::timestamptz - v_buffer,
         (s.occurred_on::text || 'T' || coalesce(s.start_time::text, '00:00:00') || 'Z')::timestamptz
           + (s.duration_minutes || ' minutes')::interval + v_buffer)
        overlaps (p_start_ts, p_start_ts + (p_duration_minutes || ' minutes')::interval)
      )
  ) then
    return false;
  end if;

  if exists (
    select 1 from bookings b
    where b.tutor_id = p_tutor_id
      and b.status = 'confirmed'
      and (b.requested_start - v_buffer, b.requested_start + (b.duration_minutes || ' minutes')::interval + v_buffer)
          overlaps (p_start_ts, p_start_ts + (p_duration_minutes || ' minutes')::interval)
  ) then
    return false;
  end if;

  return true;
end;
$$;

create function create_open_availability_booking_link(
  p_student_id uuid,
  p_service_id uuid,
  p_duration_minutes integer,
  p_buffer_minutes integer
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
  v_service services%rowtype;
  v_duration integer;
  v_token text;
  v_attempts integer := 0;
begin
  if v_tutor_id is null then
    raise exception 'Not authorized.';
  end if;

  if p_student_id is not null and not exists (
    select 1 from clients where id = p_student_id and tutor_id = v_tutor_id
  ) then
    raise exception 'Student not found.';
  end if;

  if p_service_id is not null then
    select * into v_service from services
    where id = p_service_id and tutor_id = v_tutor_id and is_active;
    if v_service.id is null then
      raise exception 'Service not found or no longer offered.';
    end if;
    v_duration := v_service.duration_minutes;
  else
    if p_duration_minutes is null or p_duration_minutes <= 0 then
      raise exception 'Pick a service or set a session duration.';
    end if;
    v_duration := p_duration_minutes;
  end if;

  if p_buffer_minutes is null or p_buffer_minutes < 0 then
    raise exception 'Buffer must be zero or a positive number of minutes.';
  end if;

  if not exists (select 1 from availability where tutor_id = v_tutor_id) then
    raise exception 'Set your weekly availability first (Schedule) — a standing link has no open hours to offer without it.';
  end if;

  loop
    v_token := encode(extensions.gen_random_bytes(16), 'hex');
    begin
      insert into booking_links (tutor_id, student_id, service_id, status, token, mode, duration_minutes, buffer_minutes)
      values (v_tutor_id, p_student_id, p_service_id, 'open', v_token, 'open_availability', v_duration, p_buffer_minutes);
      exit;
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts > 5 then
        raise exception 'Could not generate a unique link — try again.';
      end if;
    end;
  end loop;

  return v_token;
end;
$$;

-- Extends get_booking_link_public (CREATE OR REPLACE, same signature) to
-- report `mode`/`duration_minutes`/`buffer_minutes` for an open_availability
-- link. A fixed_slots link's response shape is unchanged (mode defaults to
-- 'fixed_slots' via the column default, and duration_minutes/buffer_minutes
-- are simply null/0 for it — the client only reads them when mode is
-- 'open_availability').
create or replace function get_booking_link_public(p_token text)
returns json
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_link booking_links%rowtype;
  v_tutor tutors%rowtype;
  v_service services%rowtype;
  v_slots json;
begin
  select * into v_link from booking_links where token = p_token;
  if v_link.id is null then
    return json_build_object('found', false);
  end if;

  select * into v_tutor from tutors where id = v_link.tutor_id;
  if v_link.service_id is not null then
    select * into v_service from services where id = v_link.service_id;
  end if;

  select coalesce(
    json_agg(json_build_object('id', s.id, 'start_ts', s.start_ts, 'duration_minutes', s.duration_minutes) order by s.start_ts),
    '[]'::json
  )
  into v_slots
  from booking_link_slots s
  where s.booking_link_id = v_link.id;

  return json_build_object(
    'found', true,
    'status', case
      when v_link.service_id is not null and (v_service.id is null or not v_service.is_active)
        then 'unavailable'
      else v_link.status
    end,
    'mode', v_link.mode,
    'tutor_name', v_tutor.name,
    'service_name', v_service.name,
    'service_price_cents', v_service.price_cents,
    'service_duration_minutes', v_service.duration_minutes,
    'duration_minutes', coalesce(v_service.duration_minutes, v_link.duration_minutes),
    'buffer_minutes', v_link.buffer_minutes,
    'needs_student_name', v_link.student_id is null,
    'slots', v_slots
  );
end;
$$;

-- Public read: for a given calendar date, the tutor's actually-free start
-- times on an open_availability link — candidates are generated at
-- duration_minutes stride across each availability window for that
-- weekday, then filtered through is_slot_bookable() so the UI never offers
-- (and confirm never has to reject as a surprise) a time that's outside
-- availability or already taken. Empty array for a wrong-mode/closed link
-- rather than an error — same "calm empty state, not a dead link" pattern
-- as get_booking_link_public's 'found: false'.
create function get_open_availability_slots(p_token text, p_date date)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link booking_links%rowtype;
  v_service services%rowtype;
  v_duration integer;
  v_weekday integer;
  v_window record;
  v_candidate timestamptz;
  v_window_end timestamptz;
  v_slots timestamptz[] := '{}';
begin
  select * into v_link from booking_links where token = p_token and status = 'open' and mode = 'open_availability';
  if v_link.id is null then
    return json_build_object('slots', '[]'::json);
  end if;

  if v_link.service_id is not null then
    select * into v_service from services where id = v_link.service_id and is_active;
    if v_service.id is null then
      return json_build_object('slots', '[]'::json);
    end if;
    v_duration := v_service.duration_minutes;
  else
    v_duration := v_link.duration_minutes;
  end if;

  v_weekday := extract(dow from p_date);

  for v_window in
    select start_time, end_time from availability where tutor_id = v_link.tutor_id and weekday = v_weekday
  loop
    v_candidate := (p_date::text || 'T' || v_window.start_time::text || 'Z')::timestamptz;
    v_window_end := (p_date::text || 'T' || v_window.end_time::text || 'Z')::timestamptz;
    while v_candidate + (v_duration || ' minutes')::interval <= v_window_end loop
      if is_slot_bookable(v_link.tutor_id, v_candidate, v_duration, v_link.buffer_minutes) then
        v_slots := array_append(v_slots, v_candidate);
      end if;
      v_candidate := v_candidate + (v_duration || ' minutes')::interval;
    end loop;
  end loop;

  return json_build_object(
    'slots',
    (select coalesce(json_agg(t order by t), '[]'::json) from unnest(v_slots) as t)
  );
end;
$$;

-- Public write: confirms an arbitrary (tutor-availability-contained,
-- conflict-free) start time on a standing link. Re-validates everything
-- server-side at confirm time (never trusts that the client-offered time
-- came from get_open_availability_slots) — the per-tutor advisory lock is
-- taken BEFORE the is_slot_bookable check (not just before the insert) so
-- two parents racing to grab the same time can't both pass the check
-- before either writes, same fix P9's create_booking/approve_booking
-- already apply to their own SELECT-then-INSERT.
--
-- Unlike confirm_booking_link, this never flips booking_links.status —
-- an open_availability link is standing/reusable by design, so it stays
-- 'open' after every successful confirm; only cancel_booking_link (already
-- unchanged and compatible — it just sets status='cancelled', and neither
-- chosen_slot_id nor session_id is ever set on this mode's link row) stops
-- it from being booked again.
create function confirm_open_booking_link(
  p_token text,
  p_start_ts timestamptz,
  p_parent_name text,
  p_parent_email text,
  p_student_name text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link booking_links%rowtype;
  v_tutor tutors%rowtype;
  v_service services%rowtype;
  v_duration integer;
  v_client clients%rowtype;
  v_client_id uuid;
  v_effective_rate integer;
  v_bill_travel boolean;
  v_travel_rate integer;
  v_session_id uuid;
  v_code text;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_attempts integer := 0;
  i integer;
begin
  if p_parent_email is null or btrim(p_parent_email) = '' then
    raise exception 'Email is required.';
  end if;

  select * into v_link from booking_links where token = p_token and status = 'open' and mode = 'open_availability';
  if v_link.id is null then
    raise exception 'This booking link is no longer available.';
  end if;

  select * into v_tutor from tutors where id = v_link.tutor_id;

  if v_link.service_id is not null then
    select * into v_service from services where id = v_link.service_id;
    if v_service.id is null or not v_service.is_active then
      raise exception 'This service is no longer offered — ask your tutor for a new link.';
    end if;
    v_duration := v_service.duration_minutes;
  else
    v_duration := v_link.duration_minutes;
  end if;

  -- Tutor-wide lock BEFORE the availability/overlap check — the lock, not
  -- the statement shape, is what makes this SELECT-then-INSERT safe under
  -- concurrent confirms for the same tutor (see P9's create_booking).
  perform pg_advisory_xact_lock(hashtext(v_link.tutor_id::text)::bigint);

  if not is_slot_bookable(v_link.tutor_id, p_start_ts, v_duration, v_link.buffer_minutes) then
    raise exception 'That time is no longer available — pick another.';
  end if;

  if v_link.student_id is not null then
    v_client_id := v_link.student_id;
    update clients
    set payer_name = coalesce(payer_name, nullif(btrim(p_parent_name), '')),
        payer_email = coalesce(payer_email, lower(btrim(p_parent_email)))
    where id = v_client_id;
  else
    if p_student_name is null or btrim(p_student_name) = '' then
      raise exception 'Student name is required.';
    end if;

    insert into clients (tutor_id, student_name, payer_name, payer_email, rate_type, scheduling_mode)
    values (
      v_link.tutor_id, btrim(p_student_name), nullif(btrim(p_parent_name), ''),
      lower(btrim(p_parent_email)), 'standard', 'message'
    )
    returning id into v_client_id;

    loop
      v_code := '';
      for i in 1..7 loop
        v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::integer, 1);
      end loop;
      begin
        insert into invites (tutor_id, student_id, code, status)
        values (v_link.tutor_id, v_client_id, v_code, 'active');
        exit;
      exception when unique_violation then
        v_attempts := v_attempts + 1;
        if v_attempts > 5 then
          raise exception 'Could not generate a unique invite code — try again.';
        end if;
      end;
    end loop;
  end if;

  select * into v_client from clients where id = v_client_id;

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
    service_id, service_price_cents, booking_link_id
  )
  values (
    v_link.tutor_id, v_client_id,
    (p_start_ts at time zone 'utc')::date, (p_start_ts at time zone 'utc')::time,
    v_duration, 0, v_bill_travel, v_effective_rate, v_travel_rate, 'logged',
    v_link.service_id, v_service.price_cents, v_link.id
  )
  returning id into v_session_id;

  return json_build_object('session_id', v_session_id, 'booking_link_id', v_link.id);
end;
$$;

-- get_public_tutor_profile's "Book" link selection (Q3) required a
-- fixed_slots link with a future slot — an open_availability link never has
-- slot rows, so it would never be surfaced. Widened (CREATE OR REPLACE,
-- same signature) to also accept a standing, still-open, unassigned link.
create or replace function get_public_tutor_profile(p_handle text)
returns json
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_tutor tutors%rowtype;
  v_services json;
  v_booking_token text;
begin
  select * into v_tutor from tutors where lower(handle) = lower(p_handle) and is_public;
  if v_tutor.id is null then
    return json_build_object('found', false);
  end if;

  select coalesce(
    json_agg(
      json_build_object(
        'name', s.name,
        'description', s.description,
        'duration_minutes', s.duration_minutes,
        'price_cents', case when v_tutor.show_prices then s.price_cents else null end
      )
      order by s.created_at
    ),
    '[]'::json
  )
  into v_services
  from services s
  where s.tutor_id = v_tutor.id and s.is_active;

  select bl.token into v_booking_token
  from booking_links bl
  where bl.tutor_id = v_tutor.id
    and bl.status = 'open'
    and bl.student_id is null
    and (bl.service_id is null or exists (
      select 1 from services sv where sv.id = bl.service_id and sv.is_active
    ))
    and (
      bl.mode = 'open_availability'
      or exists (select 1 from booking_link_slots s where s.booking_link_id = bl.id and s.start_ts > now())
    )
  order by bl.created_at desc
  limit 1;

  return json_build_object(
    'found', true,
    'name', v_tutor.name,
    'bio', case when v_tutor.show_bio then v_tutor.bio else null end,
    'subjects', v_tutor.subjects,
    'services', v_services,
    'booking_token', v_booking_token
  );
end;
$$;

revoke execute on function is_slot_bookable(uuid, timestamptz, integer, integer) from public;
revoke execute on function create_open_availability_booking_link(uuid, uuid, integer, integer) from public;
revoke execute on function get_open_availability_slots(text, date) from public;
revoke execute on function confirm_open_booking_link(text, timestamptz, text, text, text) from public;

grant execute on function is_slot_bookable(uuid, timestamptz, integer, integer) to anon, authenticated;
grant execute on function create_open_availability_booking_link(uuid, uuid, integer, integer) to authenticated;
grant execute on function get_open_availability_slots(text, date) to anon, authenticated;
grant execute on function confirm_open_booking_link(text, timestamptz, text, text, text) to anon, authenticated;
-- get_booking_link_public/get_public_tutor_profile keep their existing
-- grants (CREATE OR REPLACE carries them forward) — no new grant needed.
