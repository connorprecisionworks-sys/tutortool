-- D11: per-day availability hours + one-off unavailability.
--
-- "Different hours for specific days" (e.g. Fri 1-3pm vs a Mon-Thu 3-6pm
-- default) is already fully supported by the existing weekday-keyed
-- `availability` table (C2) — each weekday's windows are independent rows,
-- so a tutor can already apply a batch to Mon-Thu and a separate one to
-- Fri alone. No schema change needed for that half of D11.
--
-- The genuinely new piece is one-off date/range blocking (vacations,
-- single-day closures) — today's purely-recurring weekly model has no way
-- to express "unavailable on this specific date" without deleting and
-- re-adding a recurring window (which would wrongly block every future
-- occurrence of that weekday, not just the one date).

create table availability_blocks (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutors (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  note text,
  created_at timestamptz not null default now(),
  constraint availability_blocks_date_order check (end_date >= start_date)
);

create index availability_blocks_tutor_id_idx on availability_blocks (tutor_id);

alter table availability_blocks enable row level security;

create policy "availability_blocks_select_own" on availability_blocks
  for select using (tutor_id in (select id from tutors where auth_user_id = auth.uid()));

create policy "availability_blocks_insert_own" on availability_blocks
  for insert with check (tutor_id in (select id from tutors where auth_user_id = auth.uid()));

create policy "availability_blocks_delete_own" on availability_blocks
  for delete using (tutor_id in (select id from tutors where auth_user_id = auth.uid()));

-- No update policy — same delete + re-add convention as `availability` (P9):
-- editing a block is remove-then-re-add, not an in-place edit.

-- Short-circuit the day-level slot generator (C3's shared helper, used by
-- both the per-service and open-availability pickers) before it even loops
-- weekly windows, so a fully blocked day cheaply returns zero candidates
-- instead of generating-then-filtering every one of them.
create or replace function generate_open_slots(
  p_tutor_id uuid,
  p_duration_minutes integer,
  p_buffer_minutes integer,
  p_date date
)
returns setof timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_weekday integer;
  v_window record;
  v_candidate timestamptz;
  v_window_end timestamptz;
begin
  if exists (
    select 1 from availability_blocks ab
    where ab.tutor_id = p_tutor_id and p_date between ab.start_date and ab.end_date
  ) then
    return;
  end if;

  v_weekday := extract(dow from p_date);

  for v_window in
    select start_time, end_time from availability where tutor_id = p_tutor_id and weekday = v_weekday
  loop
    v_candidate := (p_date::text || 'T' || v_window.start_time::text || 'Z')::timestamptz;
    v_window_end := (p_date::text || 'T' || v_window.end_time::text || 'Z')::timestamptz;
    while v_candidate + (p_duration_minutes || ' minutes')::interval <= v_window_end loop
      if is_slot_bookable(p_tutor_id, v_candidate, p_duration_minutes, p_buffer_minutes) then
        return next v_candidate;
      end if;
      v_candidate := v_candidate + (p_duration_minutes || ' minutes')::interval;
    end loop;
  end loop;
end;
$$;

-- The authoritative confirm-time gate (B4) both confirm_open_booking_link
-- and confirm_public_service_booking call — gating here too (defense in
-- depth beyond generate_open_slots' day-level short-circuit above) means a
-- slot that was open when the picker loaded but got blocked in the
-- meantime still can't be confirmed.
create or replace function is_slot_bookable(
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

  if exists (
    select 1 from availability_blocks ab
    where ab.tutor_id = p_tutor_id
      and (p_start_ts at time zone 'utc')::date between ab.start_date and ab.end_date
  ) then
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
