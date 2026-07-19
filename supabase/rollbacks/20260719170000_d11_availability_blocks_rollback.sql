-- Restores is_slot_bookable and generate_open_slots to their pre-D11 bodies
-- (no availability_blocks check), then drops the new table.

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

drop table if exists availability_blocks;
