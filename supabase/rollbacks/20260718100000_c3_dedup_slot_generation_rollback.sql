-- Restores get_open_availability_slots (B4) and get_public_service_slots
-- (C3) to their pre-dedup, independently-inlined bodies, then drops the
-- shared helper.
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

create or replace function get_public_service_slots(p_handle text, p_service_id uuid, p_date date)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor tutors%rowtype;
  v_service services%rowtype;
  v_weekday integer;
  v_window record;
  v_candidate timestamptz;
  v_window_end timestamptz;
  v_slots timestamptz[] := '{}';
begin
  select * into v_tutor from tutors where lower(handle) = lower(p_handle) and is_public;
  if v_tutor.id is null then
    return json_build_object('slots', '[]'::json);
  end if;

  select * into v_service from services where id = p_service_id and tutor_id = v_tutor.id and is_active;
  if v_service.id is null then
    return json_build_object('slots', '[]'::json);
  end if;

  v_weekday := extract(dow from p_date);

  for v_window in
    select start_time, end_time from availability where tutor_id = v_tutor.id and weekday = v_weekday
  loop
    v_candidate := (p_date::text || 'T' || v_window.start_time::text || 'Z')::timestamptz;
    v_window_end := (p_date::text || 'T' || v_window.end_time::text || 'Z')::timestamptz;
    while v_candidate + (v_service.duration_minutes || ' minutes')::interval <= v_window_end loop
      if is_slot_bookable(v_tutor.id, v_candidate, v_service.duration_minutes, 0) then
        v_slots := array_append(v_slots, v_candidate);
      end if;
      v_candidate := v_candidate + (v_service.duration_minutes || ' minutes')::interval;
    end loop;
  end loop;

  return json_build_object(
    'slots',
    (select coalesce(json_agg(t order by t), '[]'::json) from unnest(v_slots) as t)
  );
end;
$$;

drop function if exists generate_open_slots(uuid, integer, integer, date);
