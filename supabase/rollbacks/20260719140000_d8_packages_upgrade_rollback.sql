-- Restore get_public_tutor_profile to its pre-D8 (D3) shape.
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
    'phone', case when v_tutor.show_phone then v_tutor.phone else null end,
    'services', v_services,
    'booking_token', v_booking_token
  );
end;
$$;

drop function if exists set_package_public(uuid, boolean);

-- create_session_with_package: restore Q5's unconditional ownership check.
create or replace function create_session_with_package(
  p_client_id uuid,
  p_package_id uuid,
  p_occurred_on date,
  p_start_time time,
  p_duration_minutes integer,
  p_travel_minutes integer,
  p_location text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
  v_package packages%rowtype;
  v_client clients%rowtype;
  v_tutor tutors%rowtype;
  v_effective_rate integer;
  v_bill_travel boolean;
  v_travel_rate integer;
  v_session_id uuid;
begin
  if v_tutor_id is null then
    raise exception 'Not authorized.';
  end if;

  if p_duration_minutes <= 0 then
    raise exception 'Duration must be more than 0 minutes.';
  end if;
  if p_travel_minutes < 0 then
    raise exception 'Travel minutes can''t be negative.';
  end if;

  select * into v_package from packages where id = p_package_id and tutor_id = v_tutor_id for update;
  if v_package.id is null then
    raise exception 'Package not found.';
  end if;
  if v_package.client_id != p_client_id then
    raise exception 'That package belongs to a different student.';
  end if;
  if v_package.status != 'active' then
    raise exception 'This package isn''t active — it may still be awaiting payment or is already used up.';
  end if;
  if v_package.remaining_sessions <= 0 then
    raise exception 'No sessions left on this package.';
  end if;

  select * into v_client from clients where id = p_client_id and tutor_id = v_tutor_id;
  if v_client.id is null then
    raise exception 'Student not found.';
  end if;
  select * into v_tutor from tutors where id = v_tutor_id;

  v_effective_rate := case
    when v_client.rate_type = 'pro_bono' then 0
    when v_client.rate_type = 'standard' then v_tutor.standard_rate_cents
    else coalesce(v_client.custom_rate_cents, v_tutor.standard_rate_cents)
  end;
  v_bill_travel := coalesce(v_client.bill_travel, v_tutor.bill_travel_default);
  v_travel_rate := coalesce(v_client.travel_rate_cents, v_tutor.travel_rate_cents, v_effective_rate);

  insert into sessions (
    tutor_id, client_id, occurred_on, start_time, duration_minutes, travel_minutes,
    location, bill_travel, effective_rate_cents, travel_rate_cents, status,
    service_id, package_id, notes
  )
  values (
    v_tutor_id, p_client_id, p_occurred_on, p_start_time, p_duration_minutes, p_travel_minutes,
    p_location, v_bill_travel, v_effective_rate, v_travel_rate, 'logged',
    v_package.service_id, p_package_id, p_notes
  )
  returning id into v_session_id;

  update packages
  set remaining_sessions = remaining_sessions - 1,
      status = case when remaining_sessions - 1 = 0 then 'depleted' else status end
  where id = p_package_id;

  return v_session_id;
end;
$$;

drop function if exists create_package(uuid, uuid, text, integer, integer, text, integer, integer, boolean);

create function create_package(
  p_client_id uuid,
  p_service_id uuid,
  p_name text,
  p_total_sessions integer,
  p_price_cents integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
  v_package_id uuid;
  v_invoice_id uuid;
begin
  if v_tutor_id is null then
    raise exception 'Not a tutor.';
  end if;

  if not exists (select 1 from clients where id = p_client_id and tutor_id = v_tutor_id) then
    raise exception 'Student not found.';
  end if;

  if p_service_id is not null and not exists (
    select 1 from services where id = p_service_id and tutor_id = v_tutor_id and is_active
  ) then
    raise exception 'Service not found or no longer offered.';
  end if;

  if p_total_sessions <= 0 then
    raise exception 'A package needs at least one session.';
  end if;
  if p_price_cents < 0 then
    raise exception 'Price must be a positive number.';
  end if;
  if p_name is null or btrim(p_name) = '' then
    raise exception 'Package name is required.';
  end if;

  insert into invoices (tutor_id, client_id, period_start, period_end, status, payment_timing)
  values (
    v_tutor_id, p_client_id, current_date, current_date, 'draft',
    (select default_payment_timing from tutors where id = v_tutor_id)
  )
  returning id into v_invoice_id;

  insert into invoice_line_items (invoice_id, session_id, description, quantity_minutes, amount_cents, line_type)
  values (v_invoice_id, null, btrim(p_name) || ' (' || p_total_sessions || ' sessions)', null, p_price_cents, 'charge');

  perform recompute_invoice_totals(v_invoice_id);

  insert into packages (tutor_id, client_id, service_id, name, total_sessions, remaining_sessions, price_cents, status, purchase_invoice_id)
  values (v_tutor_id, p_client_id, p_service_id, btrim(p_name), p_total_sessions, 0, p_price_cents, 'pending_payment', v_invoice_id)
  returning id into v_package_id;

  return v_invoice_id;
end;
$$;

revoke execute on function create_package(uuid, uuid, text, integer, integer) from public;
grant execute on function create_package(uuid, uuid, text, integer, integer) to authenticated;

drop policy "packages_select_parent" on packages;
create policy "packages_select_parent" on packages
  for select using (is_parent_of_student(client_id));

alter table packages drop constraint if exists packages_is_public_general_only;
alter table packages drop column if exists is_public;

-- Will fail if any general (client_id null) package rows exist — delete or
-- reassign them to a specific student first. Not auto-handled here since
-- picking a student for an orphaned general package is a product decision,
-- not a mechanical one.
alter table packages alter column client_id set not null;
