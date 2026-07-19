-- D8 review fixes (xhigh code-review pass):
-- 1. create_package: bound p_total_sessions so a fat-fingered count can't
--    overflow int4 arithmetic in v_subtotal, and split the "custom price"
--    error into distinct missing/negative messages instead of one that
--    always claims the price is missing even when a negative one was sent.
-- 2. set_package_public: a non-active general package (e.g. depleted) can
--    no longer be marked public — get_public_tutor_profile only ever shows
--    active packages, so allowing the toggle to succeed on a depleted one
--    silently misled the tutor into believing it was live.

create or replace function create_package(
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
  if p_total_sessions > 365 then
    raise exception 'A package can''t have more than 365 sessions.';
  end if;
  if p_name is null or btrim(p_name) = '' then
    raise exception 'Package name is required.';
  end if;
  if p_discount_type not in ('none', 'percent', 'amount') then
    raise exception 'Invalid discount type.';
  end if;

  if p_service_id is not null then
    select price_cents into v_price_per_session from services where id = p_service_id;
  else
    if p_custom_price_per_session_cents is null then
      raise exception 'Price per session is required when no service is selected.';
    end if;
    if p_custom_price_per_session_cents < 0 then
      raise exception 'Price per session must be a positive number.';
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

create or replace function set_package_public(p_package_id uuid, p_is_public boolean)
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
  if p_is_public and v_package.status != 'active' then
    raise exception 'Only an active package can be shown on your public page.';
  end if;

  update packages set is_public = p_is_public where id = p_package_id;
end;
$$;
