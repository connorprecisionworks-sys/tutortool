-- Q2: native booking links. A tutor picks a student (or leaves it open for
-- a new parent), optionally a service, and offers one or more time slots.
-- The generated /book/TOKEN link is public — no login to view or to book —
-- so every read and write on it runs through a SECURITY DEFINER function
-- granted to the `anon` role rather than relying on RLS (there's no
-- auth.uid() at all for an anonymous visitor). Confirming creates a
-- `sessions` row directly (same "booking always produces a session so
-- scheduling feeds billing with no double entry" invariant as P9's
-- bookings table) and, for an "open" link with no pre-picked student,
-- creates the client/invite-code pair too.

create table booking_links (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutors (id) on delete cascade,
  token text not null unique,
  -- null = "leave open for a new parent": confirm_booking_link creates the
  -- client record at booking time instead of attaching to an existing one.
  student_id uuid references clients (id) on delete cascade,
  service_id uuid references services (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'booked', 'cancelled')),
  chosen_slot_id uuid,
  session_id uuid references sessions (id) on delete set null,
  created_at timestamptz not null default now()
);

create table booking_link_slots (
  id uuid primary key default gen_random_uuid(),
  booking_link_id uuid not null references booking_links (id) on delete cascade,
  -- Same wall-clock-stamped-as-UTC convention as bookings.requested_start
  -- (see the TODO in app/parent/schedule/actions.ts) — no real timezone
  -- conversion in this MVP, so keep every date/time value on the same
  -- implicit-single-timezone footing instead of introducing a second one.
  start_ts timestamptz not null,
  duration_minutes integer not null check (duration_minutes > 0),
  created_at timestamptz not null default now()
);

-- Circular-looking but not actually circular: chosen_slot_id starts null
-- and is only ever set (by confirm_booking_link) after the referenced slot
-- row already exists, so there's no ordering problem at insert time.
alter table booking_links
  add constraint booking_links_chosen_slot_id_fkey
  foreign key (chosen_slot_id) references booking_link_slots (id) on delete set null;

create index booking_links_tutor_id_idx on booking_links (tutor_id);
create index booking_link_slots_booking_link_id_idx on booking_link_slots (booking_link_id);

alter table booking_links enable row level security;
alter table booking_link_slots enable row level security;

create policy "booking_links_select_own" on booking_links
  for select using (tutor_id in (select id from tutors where auth_user_id = auth.uid()));

create policy "booking_link_slots_select_own" on booking_link_slots
  for select using (
    exists (
      select 1 from booking_links bl
      where bl.id = booking_link_slots.booking_link_id
        and bl.tutor_id in (select id from tutors where auth_user_id = auth.uid())
    )
  );

-- No insert/update/delete policy on either table: create_booking_link(),
-- cancel_booking_link(), and confirm_booking_link() (below) are the only
-- sanctioned writes. Direct RLS can't safely express "confirm_booking_link
-- may write, but only via that exact flow" for an anonymous caller anyway.

create function create_booking_link(
  p_student_id uuid,
  p_service_id uuid,
  p_duration_minutes integer,
  p_slot_starts timestamptz[]
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
  v_link_id uuid;
  v_attempts integer := 0;
  v_start timestamptz;
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

  if p_slot_starts is null or array_length(p_slot_starts, 1) is null then
    raise exception 'Offer at least one time slot.';
  end if;
  if array_length(p_slot_starts, 1) > 20 then
    raise exception 'Offer at most 20 time slots on one link.';
  end if;

  loop
    -- 32 hex chars (16 random bytes) — this token is the entire access
    -- control for an anonymous public link, unlike the 7-char Student
    -- Codes a parent types in by hand, so it needs real entropy rather
    -- than being short enough to read aloud. gen_random_bytes lives in the
    -- `extensions` schema on this Supabase project (pgcrypto is installed
    -- there, not `public`) — fully qualified rather than widening
    -- search_path, which stays pinned to just `public` for SECURITY
    -- DEFINER safety.
    v_token := encode(extensions.gen_random_bytes(16), 'hex');
    begin
      insert into booking_links (tutor_id, student_id, service_id, status, token)
      values (v_tutor_id, p_student_id, p_service_id, 'open', v_token)
      returning id into v_link_id;
      exit;
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts > 5 then
        raise exception 'Could not generate a unique link — try again.';
      end if;
    end;
  end loop;

  foreach v_start in array p_slot_starts loop
    insert into booking_link_slots (booking_link_id, start_ts, duration_minutes)
    values (v_link_id, v_start, v_duration);
  end loop;

  return v_token;
end;
$$;

create function cancel_booking_link(p_booking_link_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update booking_links
  set status = 'cancelled'
  where id = p_booking_link_id and tutor_id = current_tutor_id() and status = 'open';

  if not found then
    raise exception 'Link not found, already booked, or already cancelled.';
  end if;
end;
$$;

-- Public read: returns a single JSON object rather than a table so the
-- client gets one predictable shape (no array-of-one-row indexing). Only
-- ever exposes the tutor's display name and a service's public name/price/
-- duration — never standard_rate_cents, other clients, or anything else
-- from the tutor's account.
create function get_booking_link_public(p_token text)
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
    -- 'unavailable' is a display-only status (never stored — booking_links
    -- has no such value in its check constraint): the tutor deactivated
    -- the service this link was built around after sharing it. Reported as
    -- its own state rather than silently falling back to the hourly rate,
    -- since that would bill the parent something they never saw offered.
    'found', true,
    'status', case
      when v_link.service_id is not null and (v_service.id is null or not v_service.is_active)
        then 'unavailable'
      else v_link.status
    end,
    'tutor_name', v_tutor.name,
    'service_name', v_service.name,
    'service_price_cents', v_service.price_cents,
    'service_duration_minutes', v_service.duration_minutes,
    'needs_student_name', v_link.student_id is null,
    'slots', v_slots
  );
end;
$$;

-- Public write: the sole way an anonymous visitor can create data in this
-- app. Re-derives everything from the token-matched row — never trusts a
-- caller-supplied tutor/client/slot id on its own — and locks the link row
-- before checking status so two tabs racing to confirm the same link can't
-- both succeed (the loser's UPDATE-guard-equivalent is the `for update`
-- lock plus the `status = 'open'` check happening inside one transaction).
create function confirm_booking_link(
  p_token text,
  p_slot_id uuid,
  p_parent_name text,
  p_parent_email text,
  p_student_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link booking_links%rowtype;
  v_slot booking_link_slots%rowtype;
  v_tutor tutors%rowtype;
  v_service services%rowtype;
  v_client clients%rowtype;
  v_client_id uuid;
  v_effective_rate integer;
  v_bill_travel boolean;
  v_travel_rate integer;
  v_session_id uuid;
  v_code text;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- excludes O, 0, I, 1 — matches create_invite()
  v_attempts integer := 0;
  i integer;
begin
  if p_parent_email is null or btrim(p_parent_email) = '' then
    raise exception 'Email is required.';
  end if;

  select * into v_link from booking_links where token = p_token and status = 'open' for update;
  if v_link.id is null then
    raise exception 'This booking link is no longer available.';
  end if;

  select * into v_slot from booking_link_slots where id = p_slot_id and booking_link_id = v_link.id;
  if v_slot.id is null then
    raise exception 'That time is no longer offered on this link.';
  end if;

  select * into v_tutor from tutors where id = v_link.tutor_id;
  if v_link.service_id is not null then
    select * into v_service from services where id = v_link.service_id;
    -- Re-validated at confirm time, not just at create_booking_link time:
    -- the tutor may have deactivated this service any time after sharing
    -- the link (setServiceActiveAction doesn't touch existing links), and
    -- billing at a price the parent never actually saw offered would be
    -- worse than a clear error here — get_booking_link_public already
    -- surfaces this as an 'unavailable' link before the parent gets this far.
    if v_service.id is null or not v_service.is_active then
      raise exception 'This service is no longer offered — ask your tutor for a new link.';
    end if;
  end if;

  if v_link.student_id is not null then
    v_client_id := v_link.student_id;
    -- Fills payer contact only if not already on file — a booking
    -- confirmation shouldn't clobber a payer identity the tutor already
    -- has for this student.
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

    -- Mirrors create_invite()'s codegen loop (student_code_hardening
    -- migration) — inlined rather than called directly, since create_invite
    -- derives its tutor from current_tutor_id()/auth.uid(), which is null
    -- for this anonymous, parent-facing RPC. Keeps the "never a student
    -- without a code" invariant even for a student created via a public link.
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
    service_id, service_price_cents
  )
  values (
    v_link.tutor_id, v_client_id,
    (v_slot.start_ts at time zone 'utc')::date, (v_slot.start_ts at time zone 'utc')::time,
    v_slot.duration_minutes, 0, v_bill_travel, v_effective_rate, v_travel_rate, 'logged',
    v_link.service_id, v_service.price_cents
  )
  returning id into v_session_id;

  update booking_links
  set status = 'booked', chosen_slot_id = p_slot_id, session_id = v_session_id
  where id = v_link.id;

  return v_link.id;
end;
$$;

revoke execute on function create_booking_link(uuid, uuid, integer, timestamptz[]) from public;
revoke execute on function cancel_booking_link(uuid) from public;
revoke execute on function get_booking_link_public(text) from public;
revoke execute on function confirm_booking_link(text, uuid, text, text, text) from public;

grant execute on function create_booking_link(uuid, uuid, integer, timestamptz[]) to authenticated;
grant execute on function cancel_booking_link(uuid) to authenticated;
-- get_booking_link_public/confirm_booking_link must be reachable by a
-- visitor with no Supabase session at all — that's the `anon` role, not
-- `authenticated`. Granted to both since a parent who happens to be logged
-- in (e.g. an existing portal parent opening a link for a second child)
-- should be able to use it too.
grant execute on function get_booking_link_public(text) to anon, authenticated;
grant execute on function confirm_booking_link(text, uuid, text, text, text) to anon, authenticated;
