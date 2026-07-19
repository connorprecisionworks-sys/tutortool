-- D8: packages upgrade.
-- 1. client_id becomes optional — a "general" package (client_id null) is
--    usable by any of the tutor's students, not bound to one family.
-- 2. create_package now computes price itself (per-session price from the
--    selected service, or a trusted custom per-session price when there's
--    no service to price from) times session count, then applies an
--    optional discount (percent or flat amount) — never trusts a
--    client-supplied final total.
-- 3. A general package can be marked is_public to appear on the tutor's
--    public page — enforced at the DB level (CHECK) that only a general
--    package can ever be public, since advertising a specific family's
--    package publicly would leak that family's private purchase.
-- 4. A general package has no specific payer to invoice, so unlike the
--    existing student-specific flow (draft invoice -> pending_payment ->
--    active once paid) it activates immediately with a full balance —
--    it's inventory the tutor already has (or plans to sell out of band /
--    via the public page), not a pending prepayment transaction.

alter table packages alter column client_id drop not null;

alter table packages add column is_public boolean not null default false;
alter table packages add constraint packages_is_public_general_only check (is_public = false or client_id is null);

-- A parent must never see a general package — it isn't their family's
-- purchase, it's the tutor's shared inventory. is_parent_of_student(null)
-- already evaluates to false on its own (no row has student_id = null),
-- but the explicit guard documents the intent instead of relying on that
-- implicit NULL-comparison behavior.
drop policy "packages_select_parent" on packages;
create policy "packages_select_parent" on packages
  for select using (client_id is not null and is_parent_of_student(client_id));

-- Adding params changes the function's identity — the old 5-arg overload
-- must be dropped explicitly or it lingers alongside the new one.
drop function if exists create_package(uuid, uuid, text, integer, integer);

create function create_package(
  p_client_id uuid,
  p_service_id uuid,
  p_name text,
  p_total_sessions integer,
  p_custom_price_per_session_cents integer,
  p_discount_type text,
  p_discount_percent integer,
  p_discount_amount_cents integer,
  p_is_public boolean
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
  v_package_id uuid;
  v_invoice_id uuid;
  v_price_per_session integer;
  v_subtotal integer;
  v_discount integer;
  v_total integer;
begin
  if v_tutor_id is null then
    raise exception 'Not a tutor.';
  end if;

  if p_client_id is not null and not exists (select 1 from clients where id = p_client_id and tutor_id = v_tutor_id) then
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
  if p_name is null or btrim(p_name) = '' then
    raise exception 'Package name is required.';
  end if;
  if p_discount_type not in ('none', 'percent', 'amount') then
    raise exception 'Invalid discount type.';
  end if;

  -- Price is always (re)computed here, never trusted from the client as a
  -- final number — when a service is picked, its price_cents is read fresh
  -- from the database (ignoring anything the client claims about it); a
  -- caller-supplied per-session price is only ever used when there's no
  -- service to price from, same trust boundary Q1/Q5 already draw for a
  -- session's own effective_rate_cents.
  if p_service_id is not null then
    select price_cents into v_price_per_session from services where id = p_service_id;
  else
    if p_custom_price_per_session_cents is null or p_custom_price_per_session_cents < 0 then
      raise exception 'Price per session is required when no service is selected.';
    end if;
    v_price_per_session := p_custom_price_per_session_cents;
  end if;

  v_subtotal := v_price_per_session * p_total_sessions;

  v_discount := case p_discount_type
    when 'percent' then round(v_subtotal * greatest(0, least(coalesce(p_discount_percent, 0), 100)) / 100.0)
    when 'amount' then greatest(0, coalesce(p_discount_amount_cents, 0))
    else 0
  end;
  v_discount := least(v_discount, v_subtotal);
  v_total := v_subtotal - v_discount;

  if p_client_id is not null then
    -- Student-specific: unchanged from Q5 — a draft invoice for the
    -- prepayment, package starts pending_payment with a zero balance until
    -- the invoice is paid (activate_package_for_invoice, untouched below).
    insert into invoices (tutor_id, client_id, period_start, period_end, status, payment_timing)
    values (
      v_tutor_id, p_client_id, current_date, current_date, 'draft',
      (select default_payment_timing from tutors where id = v_tutor_id)
    )
    returning id into v_invoice_id;

    insert into invoice_line_items (invoice_id, session_id, description, quantity_minutes, amount_cents, line_type)
    values (v_invoice_id, null, btrim(p_name) || ' (' || p_total_sessions || ' sessions)', null, v_total, 'charge');

    perform recompute_invoice_totals(v_invoice_id);

    insert into packages (
      tutor_id, client_id, service_id, name, total_sessions, remaining_sessions,
      price_cents, status, purchase_invoice_id, is_public
    )
    values (
      v_tutor_id, p_client_id, p_service_id, btrim(p_name), p_total_sessions, 0,
      v_total, 'pending_payment', v_invoice_id, false
    )
    returning id into v_package_id;
  else
    -- General: no specific payer to invoice, so nothing to gate activation
    -- on — it's ready to draw down immediately, same as inventory the
    -- tutor already collected payment for out of band or plans to sell via
    -- the public page (is_public).
    insert into packages (
      tutor_id, client_id, service_id, name, total_sessions, remaining_sessions,
      price_cents, status, purchase_invoice_id, is_public
    )
    values (
      v_tutor_id, null, p_service_id, btrim(p_name), p_total_sessions, p_total_sessions,
      v_total, 'active', null, coalesce(p_is_public, false)
    )
    returning id into v_package_id;
  end if;

  return json_build_object('invoice_id', v_invoice_id, 'package_id', v_package_id);
end;
$$;

revoke execute on function create_package(uuid, uuid, text, integer, integer, text, integer, integer, boolean) from public;
grant execute on function create_package(uuid, uuid, text, integer, integer, text, integer, integer, boolean) to authenticated;

-- create_session_with_package: same signature as Q5 (create or replace is
-- enough), only the ownership check changes — a general package
-- (client_id is null) is now usable by any of the tutor's students; a
-- student-specific package is still restricted to its own student exactly
-- as before. Previously `v_package.client_id != p_client_id` against a
-- null client_id evaluated to NULL (never raised) purely by SQL's NULL-
-- comparison semantics, not by design, since client_id couldn't be null
-- until this migration — made explicit and intentional here.
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
  if v_package.client_id is not null and v_package.client_id != p_client_id then
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

-- set_package_public: post-creation toggle (create_package's own
-- p_is_public only covers creation time) — mirrors service-active-toggle's
-- shape but stays a SECURITY DEFINER RPC rather than a direct table
-- update, consistent with packages having no UPDATE RLS policy at all
-- (money_mutation_architecture: every packages write goes through a
-- reviewed function, never ambient RLS).
create function set_package_public(p_package_id uuid, p_is_public boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
  v_package packages%rowtype;
begin
  if v_tutor_id is null then
    raise exception 'Not authorized.';
  end if;

  select * into v_package from packages where id = p_package_id and tutor_id = v_tutor_id;
  if v_package.id is null then
    raise exception 'Package not found.';
  end if;
  if p_is_public and v_package.client_id is not null then
    raise exception 'Only a general package (not tied to one student) can be shown on your public page.';
  end if;

  update packages set is_public = p_is_public where id = p_package_id;
end;
$$;

revoke execute on function set_package_public(uuid, boolean) from public;
grant execute on function set_package_public(uuid, boolean) to authenticated;

-- get_public_tutor_profile: same shape as D3's version, extended with a
-- 'packages' array (featured general packages only — is_public already
-- implies client_id is null via the CHECK constraint above).
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
  v_packages json;
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

  select coalesce(
    json_agg(
      json_build_object(
        'id', p.id,
        'name', p.name,
        'total_sessions', p.total_sessions,
        'price_cents', case when v_tutor.show_prices then p.price_cents else null end
      )
      order by p.created_at
    ),
    '[]'::json
  )
  into v_packages
  from packages p
  where p.tutor_id = v_tutor.id and p.is_public and p.status = 'active';

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
    'packages', v_packages,
    'booking_token', v_booking_token
  );
end;
$$;
