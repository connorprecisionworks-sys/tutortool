-- Q4: cancellations with a default policy + per-cancellation override.
--
-- Cancelling a session does NOT delete it (session history stays intact
-- for record-keeping) — it stamps cancelled_at + cancellation_handling and,
-- depending on handling:
--   'charge'   — no-op on billing. If unbilled, it still gets invoiced
--                normally later; if already billed/paid, nothing changes.
--   'rollover' — if the session was already PAID, issues a `credits` row
--                for its value, to apply toward the client's next invoice.
--                If it was never billed, there's nothing to roll over —
--                cancelling just excludes it from ever being billed.
--   'refund'   — if PAID, the app layer (Stripe isn't callable from SQL)
--                triggers a real Stripe refund for the session's value.
--                If never billed, same no-op-and-exclude as rollover.
--
-- Which handling applies when no override is given depends on the tutor's
-- cancellation_window_hours: cancelling inside that window of the
-- session's scheduled time always resolves to 'charge' (their configured
-- default policy is treated as a no-show/late-cancellation exception),
-- regardless of what their default_cancellation_policy says — matching
-- the plain-English cancellation-policy shape ("cancel with N+ hours'
-- notice and get X; less notice, you're charged in full").
--
-- credits follows the money_mutation_architecture pattern (RLS SELECT-only,
-- writes only through SECURITY DEFINER functions) since its remaining_cents
-- balance is a cross-row invariant (consumed by invoices, restored on void)
-- that a direct-client UPDATE could otherwise corrupt.

alter table tutors
  add column default_cancellation_policy text not null default 'rollover'
    check (default_cancellation_policy in ('rollover', 'refund', 'charge')),
  add column cancellation_window_hours integer not null default 24
    check (cancellation_window_hours >= 0);

alter table sessions
  add column cancelled_at timestamptz,
  add column cancellation_handling text
    check (cancellation_handling in ('rollover', 'refund', 'charge'));

create table credits (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutors (id) on delete cascade,
  client_id uuid not null references clients (id) on delete cascade,
  -- Which cancelled session generated this credit, if any — null for a
  -- credit restored from a voided invoice (see void_invoice below), which
  -- isn't tied to any one session anymore.
  session_id uuid references sessions (id) on delete set null,
  amount_cents integer not null check (amount_cents > 0),
  remaining_cents integer not null check (remaining_cents >= 0 and remaining_cents <= amount_cents),
  reason text,
  created_at timestamptz not null default now()
);

create index credits_tutor_id_idx on credits (tutor_id);
create index credits_client_id_idx on credits (client_id);

alter table credits enable row level security;

create policy "credits_select_own" on credits
  for select using (tutor_id in (select id from tutors where auth_user_id = auth.uid()));

-- No insert/update/delete policy: cancel_session() (issues), the invoice
-- credit-consumption block inside create_draft_invoice (consumes), and
-- void_invoice (restores) are the only sanctioned writes.

-- 'credit' lines are system-managed (created only by create_draft_invoice's
-- credit-consumption block) and store their amount as a POSITIVE number —
-- amount_cents keeps its existing >= 0 check unchanged; recompute_invoice_
-- totals (below) subtracts credit lines from the charge-line subtotal
-- instead of relying on negative amounts, so there's never a sign-confusion
-- risk in anything that sums amount_cents for display.
alter table invoice_line_items
  add column line_type text not null default 'charge' check (line_type in ('charge', 'credit'));

create function cancel_session(p_session_id uuid, p_override_handling text default null)
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
    -- Only a *sent* (or overdue) invoice blocks cancellation — that's the
    -- one state where the session is genuinely mid-collection on a live
    -- invoice a parent may have already seen, same "void first" rule
    -- update_session/delete_session apply to any edit of a billed session.
    -- A session still sitting on an unsent DRAFT invoice is handled below
    -- instead of blocked (draft invoices are meant to be edited freely);
    -- a PAID invoice is exactly the case this whole feature exists for.
    if v_invoice.status in ('sent', 'overdue') then
      raise exception 'This session is on a sent invoice that hasn''t been paid — void the invoice first if it needs to change.';
    end if;
  end if;

  v_was_paid := v_session.invoice_id is not null and v_invoice.status = 'paid';

  select * into v_tutor from tutors where id = v_tutor_id;
  -- Wall-clock-stamped-as-UTC convention, same as bookings.requested_start
  -- (see the TODO in app/parent/schedule/actions.ts) — no real timezone
  -- conversion in this MVP.
  v_scheduled_at := (v_session.occurred_on::text || 'T' || coalesce(v_session.start_time::text, '00:00:00') || 'Z')::timestamptz;
  v_within_window := (v_scheduled_at - now()) < (v_tutor.cancellation_window_hours || ' hours')::interval;

  v_handling := coalesce(p_override_handling, case when v_within_window then 'charge' else v_tutor.default_cancellation_policy end);

  v_amount_cents := session_amount_cents(
    v_session.duration_minutes, v_session.travel_minutes, v_session.effective_rate_cents,
    v_session.bill_travel, v_session.travel_rate_cents, v_session.service_price_cents
  );

  update sessions set cancelled_at = now(), cancellation_handling = v_handling where id = p_session_id;

  -- A session still on a DRAFT invoice gets detached from it (same as
  -- delete_session's existing draft-invoice handling) — a cancelled
  -- session has nothing left to bill, and leaving a stale line item on a
  -- still-editable draft would silently misstate its total.
  if v_session.invoice_id is not null and v_invoice.status = 'draft' then
    delete from invoice_line_items where invoice_id = v_session.invoice_id and session_id = p_session_id;
    update sessions set invoice_id = null where id = p_session_id;
    perform recompute_invoice_totals(v_session.invoice_id);
  end if;

  if v_handling = 'rollover' and v_was_paid then
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

-- recompute_invoice_totals: subtotal_cents is charge lines only; total_cents
-- subtracts credit lines, floored at 0 (defense in depth — the credit-
-- consumption block in create_draft_invoice already caps what it applies
-- at the subtotal, so this shouldn't ever actually clamp anything, but a
-- credit line surviving a later charge-line removal — see remove_line_item's
-- guard below — is exactly the scenario this floor protects against).
create or replace function recompute_invoice_totals(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subtotal integer;
  v_credit integer;
begin
  perform 1 from invoices where id = p_invoice_id for update;

  select coalesce(sum(amount_cents), 0) into v_subtotal
  from invoice_line_items
  where invoice_id = p_invoice_id and line_type = 'charge';

  select coalesce(sum(amount_cents), 0) into v_credit
  from invoice_line_items
  where invoice_id = p_invoice_id and line_type = 'credit';

  update invoices
  set subtotal_cents = v_subtotal, total_cents = greatest(v_subtotal - v_credit, 0)
  where id = p_invoice_id;
end;
$$;

-- create_draft_invoice: excludes cancelled sessions from eligibility, and
-- — after building the normal session line items — applies any available
-- credit for this client, capped at the subtotal (never goes negative) and
-- carrying the remainder forward untouched on the credits row for a future
-- invoice (oldest credit consumed first).
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

  insert into invoices (tutor_id, client_id, period_start, period_end, status)
  values (v_tutor_id, p_client_id, p_period_start, p_period_end, 'draft')
  returning id into v_invoice_id;

  for v_session in
    select * from sessions
    where tutor_id = v_tutor_id
      and client_id = p_client_id
      and invoice_id is null
      and status = 'logged'
      and cancelled_at is null
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

    -- Locking each credit row (for update) serializes against a concurrent
    -- create_draft_invoice for the same client: a second transaction's
    -- select blocks here until this one commits, then sees the
    -- already-decremented remaining_cents — not the stale pre-lock
    -- snapshot. That's exactly why the inserted line item below uses
    -- v_total_consumed (what this transaction actually deducted) instead
    -- of the pre-lock v_available_credit/v_credit_to_apply figures — using
    -- the latter would insert the same full credit amount on both
    -- invoices even when the second transaction's loop actually consumed
    -- nothing.
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

-- void_invoice: restores any applied credit (as a fresh credits row, not a
-- literal reversal of the original consumption — functionally equivalent
-- for the client's available balance and far simpler than reconstructing
-- exactly which original credit rows were partially drawn down) before
-- reverting its sessions to unbilled, same as before.
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

  update sessions set invoice_id = null, status = 'logged' where invoice_id = p_invoice_id;
end;
$$;

-- remove_line_item: once ANY credit line exists on the invoice, blocks
-- removing ANY line item on it — not just the credit line itself. The
-- credit line's amount was fixed at draft-build time based on the
-- subtotal that existed then; removing a charge line afterward would
-- shrink the subtotal out from under an already-consumed (remaining_cents
-- already decremented) credit with no way to reconcile the difference
-- back. Void the whole draft and rebuild instead, which restores the
-- credit cleanly via void_invoice above and lets create_draft_invoice
-- reapply it correctly against the new subtotal.
create or replace function remove_line_item(p_line_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
  v_session_id uuid;
  v_line_type text;
begin
  select invoice_id, session_id, line_type into v_invoice_id, v_session_id, v_line_type
  from invoice_line_items
  where id = p_line_item_id;

  if v_invoice_id is null then
    raise exception 'Line item not found.';
  end if;

  if not exists (
    select 1 from invoices
    where id = v_invoice_id and tutor_id = current_tutor_id() and status = 'draft'
  ) then
    raise exception 'Invoice not found or not editable.';
  end if;

  if v_line_type = 'credit' or exists (
    select 1 from invoice_line_items where invoice_id = v_invoice_id and line_type = 'credit'
  ) then
    raise exception 'A credit is applied to this invoice — void it and rebuild the draft instead of editing individual lines.';
  end if;

  if v_session_id is not null then
    update sessions set invoice_id = null where id = v_session_id;
  end if;

  delete from invoice_line_items where id = p_line_item_id;

  perform recompute_invoice_totals(v_invoice_id);
end;
$$;

-- update_session/delete_session: a cancelled session is the historical
-- record of a cancellation (with its resolved handling) — editing or
-- deleting it afterward would let a tutor silently rewrite or erase that
-- record, the same "already billed" style hole update_session/
-- delete_session already close for billed sessions.
create or replace function update_session(
  p_session_id uuid,
  p_occurred_on date,
  p_start_time time,
  p_duration_minutes integer,
  p_travel_minutes integer,
  p_location text,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
  v_session sessions%rowtype;
  v_client clients%rowtype;
  v_tutor tutors%rowtype;
  v_effective_rate integer;
  v_bill_travel boolean;
  v_travel_rate integer;
  v_line_item_id uuid;
  v_amount_cents integer;
begin
  if v_tutor_id is null then
    raise exception 'Not authorized.';
  end if;

  select * into v_session from sessions where id = p_session_id and tutor_id = v_tutor_id for update;
  if v_session.id is null then
    raise exception 'Session not found.';
  end if;
  if v_session.status = 'billed' then
    raise exception 'This session is already billed and can''t be edited. Void the invoice first if it needs to change.';
  end if;
  if v_session.cancelled_at is not null then
    raise exception 'This session was cancelled and can''t be edited — its record is kept as-is.';
  end if;
  if p_duration_minutes <= 0 then
    raise exception 'Duration must be more than 0 minutes.';
  end if;
  if p_travel_minutes < 0 then
    raise exception 'Travel minutes can''t be negative.';
  end if;

  if v_session.service_id is not null then
    p_duration_minutes := v_session.duration_minutes;
  end if;

  if v_session.invoice_id is not null then
    if not exists (
      select 1 from invoices
      where id = v_session.invoice_id and p_occurred_on between period_start and period_end
    ) then
      raise exception 'That date falls outside this session''s invoice period — remove it from the invoice first if it needs to move.';
    end if;
  end if;

  select * into v_client from clients where id = v_session.client_id;
  select * into v_tutor from tutors where id = v_tutor_id;

  v_effective_rate := case
    when v_client.rate_type = 'pro_bono' then 0
    when v_client.rate_type = 'standard' then v_tutor.standard_rate_cents
    else coalesce(v_client.custom_rate_cents, v_tutor.standard_rate_cents)
  end;
  v_bill_travel := coalesce(v_client.bill_travel, v_tutor.bill_travel_default);
  v_travel_rate := case
    when v_bill_travel then coalesce(v_client.travel_rate_cents, v_tutor.travel_rate_cents, v_effective_rate)
    else null
  end;

  update sessions
  set occurred_on = p_occurred_on,
      start_time = p_start_time,
      duration_minutes = p_duration_minutes,
      travel_minutes = p_travel_minutes,
      location = p_location,
      bill_travel = v_bill_travel,
      effective_rate_cents = v_effective_rate,
      travel_rate_cents = v_travel_rate,
      notes = p_notes
  where id = p_session_id;

  if v_session.invoice_id is not null then
    v_amount_cents := session_amount_cents(
      p_duration_minutes, p_travel_minutes, v_effective_rate, v_bill_travel, v_travel_rate, v_session.service_price_cents
    );

    select id into v_line_item_id from invoice_line_items
    where invoice_id = v_session.invoice_id and session_id = p_session_id;

    if v_line_item_id is not null then
      update invoice_line_items
      set amount_cents = v_amount_cents,
          description = 'Session on ' || to_char(p_occurred_on, 'Mon DD, YYYY')
            || case when p_travel_minutes > 0 and v_bill_travel
                 then ' (' || p_duration_minutes || ' min + ' || p_travel_minutes || ' min travel)'
                 else ' (' || p_duration_minutes || ' min)'
               end,
          quantity_minutes = p_duration_minutes + case when v_bill_travel then p_travel_minutes else 0 end
      where id = v_line_item_id;

      perform recompute_invoice_totals(v_session.invoice_id);
    end if;
  end if;
end;
$$;

create or replace function delete_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
  v_session sessions%rowtype;
begin
  if v_tutor_id is null then
    raise exception 'Not authorized.';
  end if;

  select * into v_session from sessions where id = p_session_id and tutor_id = v_tutor_id for update;
  if v_session.id is null then
    raise exception 'Session not found.';
  end if;
  if v_session.status = 'billed' then
    raise exception 'This session is on a sent or paid invoice — void that invoice first if it needs to change.';
  end if;
  if v_session.cancelled_at is not null then
    raise exception 'This session was cancelled and can''t be deleted — its record is kept as-is.';
  end if;

  if v_session.invoice_id is not null then
    delete from invoice_line_items
    where invoice_id = v_session.invoice_id and session_id = p_session_id;

    perform recompute_invoice_totals(v_session.invoice_id);
  end if;

  delete from sessions where id = p_session_id;
end;
$$;

-- delete_draft_invoice: same credit-restoration addition as void_invoice —
-- a draft never sent still needs its already-applied credit given back
-- before the invoice (and its credit line item) disappear.
create or replace function delete_draft_invoice(p_invoice_id uuid)
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
  if v_tutor_id is null then
    raise exception 'Not authorized.';
  end if;

  select client_id into v_client_id
  from invoices where id = p_invoice_id and tutor_id = v_tutor_id and status = 'draft' for update;
  if v_client_id is null then
    raise exception 'Only a draft invoice can be deleted — void it instead if it has already been sent.';
  end if;

  for v_credit_line in
    select * from invoice_line_items where invoice_id = p_invoice_id and line_type = 'credit'
  loop
    insert into credits (tutor_id, client_id, session_id, amount_cents, remaining_cents, reason)
    values (v_tutor_id, v_client_id, null, v_credit_line.amount_cents, v_credit_line.amount_cents, 'Restored from deleted draft invoice');
  end loop;

  delete from invoices where id = p_invoice_id and tutor_id = v_tutor_id and status = 'draft';
end;
$$;

revoke execute on function cancel_session(uuid, text) from public;
grant execute on function cancel_session(uuid, text) to authenticated;
-- recompute_invoice_totals/create_draft_invoice/void_invoice/remove_line_item/
-- delete_draft_invoice keep their existing signatures — CREATE OR REPLACE
-- above already carries forward the grants from the migrations that first
-- created them (P3/P4 and the CRUD-invoices migration), no new revoke/grant
-- needed for those.
