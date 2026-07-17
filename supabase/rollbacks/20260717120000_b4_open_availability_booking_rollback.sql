drop function if exists confirm_open_booking_link(text, timestamptz, text, text, text);
drop function if exists get_open_availability_slots(text, date);
drop function if exists create_open_availability_booking_link(uuid, uuid, integer, integer);
drop function if exists is_slot_bookable(uuid, timestamptz, integer, integer);

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
    and exists (
      select 1 from booking_link_slots s where s.booking_link_id = bl.id and s.start_ts > now()
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
    'tutor_name', v_tutor.name,
    'service_name', v_service.name,
    'service_price_cents', v_service.price_cents,
    'service_duration_minutes', v_service.duration_minutes,
    'needs_student_name', v_link.student_id is null,
    'slots', v_slots
  );
end;
$$;

alter table sessions drop column if exists booking_link_id;

alter table booking_links
  drop constraint if exists booking_links_open_availability_duration_check,
  drop column if exists mode,
  drop column if exists duration_minutes,
  drop column if exists buffer_minutes;
