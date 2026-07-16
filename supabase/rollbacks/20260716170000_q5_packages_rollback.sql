-- Rollback for 20260716170000_q5_packages.sql — restores mark_invoice_paid/
-- void_invoice/create_draft_invoice/send_invoice/cancel_session to their
-- post-Q4 (pre-Q5) bodies, then drops packages and the new columns.

revoke execute on function create_package(uuid, uuid, text, integer, integer) from authenticated;
revoke execute on function create_session_with_package(uuid, uuid, date, time, integer, integer, text, text) from authenticated;
revoke execute on function activate_package_for_invoice(uuid) from authenticated;
drop function if exists create_package(uuid, uuid, text, integer, integer);
drop function if exists create_session_with_package(uuid, uuid, date, time, integer, integer, text, text);
drop function if exists activate_package_for_invoice(uuid);

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

create or replace function send_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
  v_terms text;
begin
  select invoice_terms into v_terms from tutors where id = v_tutor_id;

  update invoices
  set status = 'sent',
      sent_at = now(),
      due_date = (current_date + case v_terms
        when 'net_7' then 7
        when 'net_14' then 14
        when 'net_30' then 30
        else 0
      end)
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
end;
$$;

drop policy if exists "packages_select_parent" on packages;
drop policy if exists "packages_select_own" on packages;

-- Restore sessions_insert_own to its pre-Q5 form before dropping
-- package_id — the Q5 policy's WITH CHECK references that column, so
-- dropping the column first would fail (or, with CASCADE, silently take
-- the policy with it rather than leaving the intended pre-Q5 policy).
drop policy if exists "sessions_insert_own" on sessions;

create policy "sessions_insert_own" on sessions
  for insert with check (
    tutor_id in (select id from tutors where auth_user_id = auth.uid())
    and client_id in (
      select id from clients
      where tutor_id in (select id from tutors where auth_user_id = auth.uid())
    )
  );

alter table sessions drop column if exists package_id;

drop table if exists packages;

alter table invoices drop column if exists payment_timing;
alter table tutors drop column if exists default_payment_timing;
