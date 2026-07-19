-- Restore get_public_tutor_profile to its pre-D3 (C4) shape, then drop the
-- columns it referenced.
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
        'id', s.id,
        'name', s.name,
        'description', s.description,
        'duration_minutes', s.duration_minutes,
        'price_cents', case when v_tutor.show_prices then s.price_cents else null end
      )
      order by s.sort_order, s.created_at
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
    'name', coalesce(nullif(btrim(v_tutor.public_display_name), ''), v_tutor.name),
    'avatar_path', v_tutor.avatar_path,
    'headline', v_tutor.headline,
    'bio', case when v_tutor.show_bio then v_tutor.bio else null end,
    'subjects', v_tutor.subjects,
    'welcome_note', v_tutor.welcome_note,
    'booking_cta_label', v_tutor.booking_cta_label,
    'services', v_services,
    'booking_token', v_booking_token
  );
end;
$$;

alter table tutors
  drop column if exists phone,
  drop column if exists show_phone;
