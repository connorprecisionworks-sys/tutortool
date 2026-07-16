-- Q5: pay-before/pay-after preference, and prepaid session packages.
--
-- Packages reuse the entire existing invoice/Stripe/reminder pipeline for
-- collecting the prepayment instead of building a second payment path:
-- create_package() creates the package row (status='pending_payment') AND
-- a normal draft invoice with one manual line item for the package price.
-- The tutor sends that invoice exactly like any other; when it's marked
-- paid — by the Stripe webhook OR the manual mark-paid function, both
-- touched below — the linked package activates (remaining_sessions =
-- total_sessions). Logging a session against an active package draws the
-- balance down by one instead of creating a separate bill for it (it's
-- already paid for); cancelling a package-drawn session restores the
-- balance instead of issuing a dollar credit (packages track a session
-- count, not a cent amount — Q4's `credits` table doesn't apply here).
--
-- packages follows the money_mutation_architecture pattern (RLS
-- SELECT-only, writes only through SECURITY DEFINER functions) since
-- remaining_sessions is a cross-row invariant (never negative, never
-- exceeds total_sessions, must track exactly how many sessions were
-- logged against it) a direct client UPDATE could otherwise corrupt.

alter table tutors
  add column default_payment_timing text not null default 'pay_after'
    check (default_payment_timing in ('pay_before', 'pay_after'));

alter table invoices
  add column payment_timing text not null default 'pay_after'
    check (payment_timing in ('pay_before', 'pay_after'));

create table packages (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutors (id) on delete cascade,
  client_id uuid not null references clients (id) on delete cascade,
  service_id uuid references services (id) on delete set null,
  name text not null,
  total_sessions integer not null check (total_sessions > 0),
  remaining_sessions integer not null default 0 check (remaining_sessions >= 0 and remaining_sessions <= total_sessions),
  price_cents integer not null check (price_cents >= 0),
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'active', 'depleted', 'cancelled')),
  purchase_invoice_id uuid references invoices (id) on delete set null,
  created_at timestamptz not null default now()
);

create index packages_tutor_id_idx on packages (tutor_id);
create index packages_client_id_idx on packages (client_id);

alter table packages enable row level security;

create policy "packages_select_own" on packages
  for select using (tutor_id in (select id from tutors where auth_user_id = auth.uid()));

create policy "packages_select_parent" on packages
  for select using (is_parent_of_student(client_id));

-- No insert/update/delete policy: create_package() (issues),
-- create_session_with_package()/cancel_session() (draw down/restore), and
-- mark_invoice_paid()/the Stripe webhook (activate) are the only
-- sanctioned writes.

alter table sessions
  add column package_id uuid references packages (id) on delete set null;

-- sessions_insert_own (P2) checked only tutor/client ownership — it never
-- knew about package_id, so a direct client insert could set it to any
-- package (someone else's, a depleted/cancelled one, wrong client) with
-- none of create_session_with_package's balance/status/ownership checks.
-- sessions_update_own was already dropped in the Q1 CRUD pass (update_session
-- is the only write path there, and its SET clause never touches
-- package_id), so this is the one remaining direct-write gap to close:
-- package_id may only ever be set through create_session_with_package.
drop policy "sessions_insert_own" on sessions;

create policy "sessions_insert_own" on sessions
  for insert with check (
    tutor_id in (select id from tutors where auth_user_id = auth.uid())
    and client_id in (
      select id from clients
      where tutor_id in (select id from tutors where auth_user_id = auth.uid())
    )
    and package_id is null
  );

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

  -- payment_timing set explicitly from the tutor's default (mirrors
  -- create_draft_invoice) — a package purchase is the canonical "pay
  -- before" case; leaving this column at its schema default ('pay_after')
  -- would silently bill the prepayment on the tutor's normal net terms
  -- instead of due immediately.
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

  -- Returns the purchase invoice id, not the package id — the caller's
  -- only use for either is redirecting to the invoice to review/send it
  -- (mirrors create_draft_invoice's own return value), so returning it
  -- directly avoids a second round-trip to look it back up.
  return v_invoice_id;
end;
$$;

-- create_session_with_package: the sanctioned way to log a session that
-- draws down a prepaid package instead of billing separately. Locks the
-- package row before checking status/balance so two concurrent draws
-- against the last remaining session can't both succeed.
create function create_session_with_package(
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

  -- Informational snapshot only (package sessions aren't separately
  -- billed) — kept for consistency with every other session row and so
  -- philanthropic/value-given math has something to read.
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

-- Shared by mark_invoice_paid (below) and the Stripe webhook (which uses
-- the service-role admin client, bypassing RLS/grants entirely — this
-- keeps the "remaining_sessions = total_sessions" atomic update in one
-- place rather than duplicating it, since the webhook's query builder
-- can't express a same-row column reference in a plain .update() call.
--
-- Deliberately does NOT trust its caller to have already verified payment
-- — it's granted to `authenticated` (mark_invoice_paid needs that to call
-- it, per this codebase's convention that invoker-mode helpers need their
-- own explicit grant even when only meant to be called from within a
-- SECURITY DEFINER function), which means ANY authenticated tutor could
-- call it directly with an arbitrary invoice_id. The `status = 'paid'`
-- check below is what actually closes that off: activation only ever
-- fires for an invoice that is genuinely already paid in the database, so
-- calling this early/out of band/with someone else's invoice_id can never
-- activate a package for free — it can at most no-op.
create function activate_package_for_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from invoices where id = p_invoice_id and status = 'paid') then
    return;
  end if;

  update packages
  set status = 'active', remaining_sessions = total_sessions
  where purchase_invoice_id = p_invoice_id and status = 'pending_payment';
end;
$$;

-- mark_invoice_paid: activates a linked package (if this invoice was one's
-- purchase_invoice_id) in the same transaction as marking it paid.
create or replace function mark_invoice_paid(p_invoice_id uuid, p_method text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update invoices
  set status = 'paid', paid_at = now(), paid_method = p_method
  where id = p_invoice_id
    and tutor_id = current_tutor_id()
    and status in ('sent', 'overdue');

  if not found then
    raise exception 'Invoice not found or not payable.';
  end if;

  perform activate_package_for_invoice(p_invoice_id);
end;
$$;

-- void_invoice: cancels a still-unpaid package whose prepayment invoice
-- just got voided — an active (already-paid) package is untouched, only
-- one still stuck at 'pending_payment' (never activated) makes sense to
-- cancel here.
create or replace function void_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
  v_client_id uuid;
  v_credit_line record;
begin
  select client_id into v_client_id from invoices where id = p_invoice_id and tutor_id = v_tutor_id;

  update invoices
  set status = 'void'
  where id = p_invoice_id
    and tutor_id = v_tutor_id
    and status in ('draft', 'sent', 'overdue');

  if not found then
    raise exception 'Invoice not found or already paid/void.';
  end if;

  for v_credit_line in
    select * from invoice_line_items where invoice_id = p_invoice_id and line_type = 'credit'
  loop
    insert into credits (tutor_id, client_id, session_id, amount_cents, remaining_cents, reason)
    values (v_tutor_id, v_client_id, null, v_credit_line.amount_cents, v_credit_line.amount_cents, 'Restored from voided invoice');
  end loop;

  update packages set status = 'cancelled' where purchase_invoice_id = p_invoice_id and status = 'pending_payment';

  update sessions set invoice_id = null, status = 'logged' where invoice_id = p_invoice_id;
end;
$$;

-- create_draft_invoice: package-drawn sessions are already paid for —
-- excluded from billing eligibility the same way cancelled sessions are.
create or replace function create_draft_invoice(
  p_client_id uuid,
  p_period_start date,
  p_period_end date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
  v_invoice_id uuid;
  v_session record;
  v_line_count integer := 0;
  v_subtotal integer := 0;
  v_available_credit integer;
  v_credit_to_apply integer;
  v_credit_row credits%rowtype;
  v_consume integer;
  v_total_consumed integer;
begin
  if v_tutor_id is null then
    raise exception 'Not a tutor.';
  end if;

  if not exists (select 1 from clients where id = p_client_id and tutor_id = v_tutor_id) then
    raise exception 'Student not found.';
  end if;

  insert into invoices (tutor_id, client_id, period_start, period_end, status, payment_timing)
  values (
    v_tutor_id, p_client_id, p_period_start, p_period_end, 'draft',
    (select default_payment_timing from tutors where id = v_tutor_id)
  )
  returning id into v_invoice_id;

  for v_session in
    select * from sessions
    where tutor_id = v_tutor_id
      and client_id = p_client_id
      and invoice_id is null
      and status = 'logged'
      and cancelled_at is null
      and package_id is null
      and occurred_on between p_period_start and p_period_end
    order by occurred_on
    for update
  loop
    insert into invoice_line_items (invoice_id, session_id, description, quantity_minutes, amount_cents, line_type)
    values (
      v_invoice_id,
      v_session.id,
      'Session on ' || to_char(v_session.occurred_on, 'Mon DD, YYYY')
        || case when v_session.travel_minutes > 0 and v_session.bill_travel
             then ' (' || v_session.duration_minutes || ' min + ' || v_session.travel_minutes || ' min travel)'
             else ' (' || v_session.duration_minutes || ' min)'
           end,
      v_session.duration_minutes + case when v_session.bill_travel then v_session.travel_minutes else 0 end,
      session_amount_cents(
        v_session.duration_minutes,
        v_session.travel_minutes,
        v_session.effective_rate_cents,
        v_session.bill_travel,
        v_session.travel_rate_cents,
        v_session.service_price_cents
      ),
      'charge'
    );

    update sessions set invoice_id = v_invoice_id where id = v_session.id;
    v_line_count := v_line_count + 1;
  end loop;

  if v_line_count = 0 then
    delete from invoices where id = v_invoice_id;
    raise exception 'No unbilled sessions for that student in that date range.';
  end if;

  select coalesce(sum(amount_cents), 0) into v_subtotal
  from invoice_line_items
  where invoice_id = v_invoice_id and line_type = 'charge';

  select coalesce(sum(remaining_cents), 0) into v_available_credit
  from credits
  where tutor_id = v_tutor_id and client_id = p_client_id and remaining_cents > 0;

  if v_available_credit > 0 and v_subtotal > 0 then
    v_credit_to_apply := least(v_available_credit, v_subtotal);
    v_total_consumed := 0;

    for v_credit_row in
      select * from credits
      where tutor_id = v_tutor_id and client_id = p_client_id and remaining_cents > 0
      order by created_at
      for update
    loop
      exit when v_credit_to_apply <= 0;
      v_consume := least(v_credit_row.remaining_cents, v_credit_to_apply);
      update credits set remaining_cents = remaining_cents - v_consume where id = v_credit_row.id;
      v_credit_to_apply := v_credit_to_apply - v_consume;
      v_total_consumed := v_total_consumed + v_consume;
    end loop;

    if v_total_consumed > 0 then
      insert into invoice_line_items (invoice_id, session_id, description, quantity_minutes, amount_cents, line_type)
      values (v_invoice_id, null, 'Credit applied', null, v_total_consumed, 'credit');
    end if;
  end if;

  perform recompute_invoice_totals(v_invoice_id);

  return v_invoice_id;
end;
$$;

-- send_invoice: a 'pay_before' invoice is due immediately regardless of
-- the tutor's usual invoice_terms — the whole point of the preference is
-- to collect payment ahead of (or without waiting on) the normal net
-- terms. 'pay_after' keeps the existing terms-based due date, unchanged.
create or replace function send_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
  v_terms text;
  v_timing text;
begin
  select invoice_terms into v_terms from tutors where id = v_tutor_id;
  select payment_timing into v_timing from invoices where id = p_invoice_id;

  update invoices
  set status = 'sent',
      sent_at = now(),
      due_date = case
        when v_timing = 'pay_before' then current_date
        else (current_date + case v_terms
          when 'net_7' then 7
          when 'net_14' then 14
          when 'net_30' then 30
          else 0
        end)
      end
  where id = p_invoice_id
    and tutor_id = v_tutor_id
    and status = 'draft'
    and exists (select 1 from invoice_line_items where invoice_id = p_invoice_id);

  if not found then
    raise exception 'Invoice not found, already sent, or has no line items.';
  end if;

  update sessions set status = 'billed' where invoice_id = p_invoice_id;
end;
$$;

-- cancel_session: a package-drawn session restores the balance on
-- rollover/refund (packages track a session count, not a dollar amount —
-- there's no separate per-session charge to actually refund out of a
-- lump-sum package purchase, so 'refund' is treated the same as
-- 'rollover' here; a true partial-refund-of-a-package is a distinct,
-- larger feature left out of this scope). 'charge' leaves the balance
-- drawn down — the standard "late cancellation forfeits the session" rule.
create or replace function cancel_session(p_session_id uuid, p_override_handling text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
  v_session sessions%rowtype;
  v_tutor tutors%rowtype;
  v_invoice invoices%rowtype;
  v_scheduled_at timestamptz;
  v_within_window boolean;
  v_handling text;
  v_amount_cents integer;
  v_was_paid boolean;
begin
  if v_tutor_id is null then
    raise exception 'Not authorized.';
  end if;

  select * into v_session from sessions where id = p_session_id and tutor_id = v_tutor_id for update;
  if v_session.id is null then
    raise exception 'Session not found.';
  end if;
  if v_session.cancelled_at is not null then
    raise exception 'This session is already cancelled.';
  end if;
  if p_override_handling is not null and p_override_handling not in ('rollover', 'refund', 'charge') then
    raise exception 'Invalid cancellation handling.';
  end if;

  if v_session.invoice_id is not null then
    select * into v_invoice from invoices where id = v_session.invoice_id;
    if v_invoice.status in ('sent', 'overdue') then
      raise exception 'This session is on a sent invoice that hasn''t been paid — void the invoice first if it needs to change.';
    end if;
  end if;

  v_was_paid := v_session.invoice_id is not null and v_invoice.status = 'paid';

  select * into v_tutor from tutors where id = v_tutor_id;
  v_scheduled_at := (v_session.occurred_on::text || 'T' || coalesce(v_session.start_time::text, '00:00:00') || 'Z')::timestamptz;
  v_within_window := (v_scheduled_at - now()) < (v_tutor.cancellation_window_hours || ' hours')::interval;

  v_handling := coalesce(p_override_handling, case when v_within_window then 'charge' else v_tutor.default_cancellation_policy end);

  v_amount_cents := session_amount_cents(
    v_session.duration_minutes, v_session.travel_minutes, v_session.effective_rate_cents,
    v_session.bill_travel, v_session.travel_rate_cents, v_session.service_price_cents
  );

  update sessions set cancelled_at = now(), cancellation_handling = v_handling where id = p_session_id;

  if v_session.invoice_id is not null and v_invoice.status = 'draft' then
    delete from invoice_line_items where invoice_id = v_session.invoice_id and session_id = p_session_id;
    update sessions set invoice_id = null where id = p_session_id;
    perform recompute_invoice_totals(v_session.invoice_id);
  end if;

  if v_session.package_id is not null then
    if v_handling in ('rollover', 'refund') then
      update packages
      set remaining_sessions = remaining_sessions + 1,
          status = case when status = 'depleted' then 'active' else status end
      where id = v_session.package_id;
    end if;
  elsif v_handling = 'rollover' and v_was_paid then
    insert into credits (tutor_id, client_id, session_id, amount_cents, remaining_cents, reason)
    values (v_tutor_id, v_session.client_id, p_session_id, v_amount_cents, v_amount_cents, 'Rollover credit for cancelled session on ' || v_session.occurred_on);
  end if;

  return json_build_object(
    'handling', v_handling,
    'was_paid', v_was_paid,
    'invoice_id', v_session.invoice_id,
    'amount_cents', v_amount_cents,
    'client_id', v_session.client_id
  );
end;
$$;

revoke execute on function create_package(uuid, uuid, text, integer, integer) from public;
revoke execute on function create_session_with_package(uuid, uuid, date, time, integer, integer, text, text) from public;
revoke execute on function activate_package_for_invoice(uuid) from public;

grant execute on function create_package(uuid, uuid, text, integer, integer) to authenticated;
grant execute on function create_session_with_package(uuid, uuid, date, time, integer, integer, text, text) to authenticated;
grant execute on function activate_package_for_invoice(uuid) to authenticated;
-- mark_invoice_paid/void_invoice/create_draft_invoice/send_invoice/
-- cancel_session keep their existing signatures — CREATE OR REPLACE above
-- carries forward the grants from the migrations that first created them,
-- no new revoke/grant needed for those.
