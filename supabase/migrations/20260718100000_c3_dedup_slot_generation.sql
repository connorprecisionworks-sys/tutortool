-- Fix from code review of C3: get_public_service_slots (this migration's
-- sibling, 20260718090000) copy-pasted the candidate-generation loop out of
-- get_open_availability_slots (B4) verbatim, creating two independently
-- maintained copies of "stride through weekly availability at a duration,
-- filter through is_slot_bookable" that could silently diverge on a future
-- fix. Extracted into one shared set-returning helper both now call.
--
-- Note (scope decision, not fixed here): confirm_open_booking_link (B4),
-- confirm_booking_link (Q2), and confirm_public_service_booking (C3) share
-- a similar "create student + invite + session" block — a pre-existing
-- 2-way duplication between Q2/B4 that C3 continues as a 3-way one, not a
-- pattern introduced fresh by this migration. Left as-is rather than
-- refactored: those two functions are already shipped, reviewed, and QA'd
-- in prior batches, and unifying them here would mean touching working
-- booking flows unrelated to C3's actual scope for a cleanup-only change.
-- A future dedicated pass ("unify the three anonymous-booking confirm
-- functions") is the right place for that, not a fix folded into C3.
create function generate_open_slots(
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

create or replace function get_open_availability_slots(p_token text, p_date date)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link booking_links%rowtype;
  v_service services%rowtype;
  v_duration integer;
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

  return json_build_object(
    'slots',
    (select coalesce(json_agg(t order by t), '[]'::json)
     from generate_open_slots(v_link.tutor_id, v_duration, v_link.buffer_minutes, p_date) as t)
  );
end;
$$;

create or replace function get_public_service_slots(p_handle text, p_service_id uuid, p_date date)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor tutors%rowtype;
  v_service services%rowtype;
begin
  select * into v_tutor from tutors where lower(handle) = lower(p_handle) and is_public;
  if v_tutor.id is null then
    return json_build_object('slots', '[]'::json);
  end if;

  select * into v_service from services where id = p_service_id and tutor_id = v_tutor.id and is_active;
  if v_service.id is null then
    return json_build_object('slots', '[]'::json);
  end if;

  return json_build_object(
    'slots',
    (select coalesce(json_agg(t order by t), '[]'::json)
     from generate_open_slots(v_tutor.id, v_service.duration_minutes, 0, p_date) as t)
  );
end;
$$;

revoke execute on function generate_open_slots(uuid, integer, integer, date) from public;
grant execute on function generate_open_slots(uuid, integer, integer, date) to anon, authenticated;
-- get_open_availability_slots/get_public_service_slots keep their existing
-- grants (CREATE OR REPLACE carries them forward).
