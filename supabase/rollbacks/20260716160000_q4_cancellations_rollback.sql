-- Rollback for 20260716160000_q4_cancellations.sql

revoke execute on function cancel_session(uuid, text) from authenticated;
drop function if exists cancel_session(uuid, text);

-- Restores update_session/delete_session to their post-Q1 (pre-Q4) bodies
-- — i.e. keeps Q1's service_id duration-lock, just drops Q4's cancelled_at
-- guard.
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

  if v_session.invoice_id is not null then
    delete from invoice_line_items
    where invoice_id = v_session.invoice_id and session_id = p_session_id;

    perform recompute_invoice_totals(v_session.invoice_id);
  end if;

  delete from sessions where id = p_session_id;
end;
$$;

create or replace function delete_draft_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
begin
  if v_tutor_id is null then
    raise exception 'Not authorized.';
  end if;

  perform 1 from invoices where id = p_invoice_id and tutor_id = v_tutor_id and status = 'draft' for update;
  if not found then
    raise exception 'Only a draft invoice can be deleted — void it instead if it has already been sent.';
  end if;

  delete from invoices where id = p_invoice_id and tutor_id = v_tutor_id and status = 'draft';
end;
$$;

create or replace function remove_line_item(p_line_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
  v_session_id uuid;
begin
  select invoice_id, session_id into v_invoice_id, v_session_id
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

  if v_session_id is not null then
    update sessions set invoice_id = null where id = v_session_id;
  end if;

  delete from invoice_line_items where id = p_line_item_id;

  perform recompute_invoice_totals(v_invoice_id);
end;
$$;

create or replace function void_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update invoices
  set status = 'void'
  where id = p_invoice_id
    and tutor_id = current_tutor_id()
    and status in ('draft', 'sent', 'overdue');

  if not found then
    raise exception 'Invoice not found or already paid/void.';
  end if;

  update sessions set invoice_id = null, status = 'logged' where invoice_id = p_invoice_id;
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
      and occurred_on between p_period_start and p_period_end
    order by occurred_on
    for update
  loop
    insert into invoice_line_items (invoice_id, session_id, description, quantity_minutes, amount_cents)
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
      )
    );

    update sessions set invoice_id = v_invoice_id where id = v_session.id;
    v_line_count := v_line_count + 1;
  end loop;

  if v_line_count = 0 then
    delete from invoices where id = v_invoice_id;
    raise exception 'No unbilled sessions for that student in that date range.';
  end if;

  perform recompute_invoice_totals(v_invoice_id);

  return v_invoice_id;
end;
$$;

create or replace function recompute_invoice_totals(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
begin
  perform 1 from invoices where id = p_invoice_id for update;

  select coalesce(sum(amount_cents), 0) into v_total
  from invoice_line_items
  where invoice_id = p_invoice_id;

  update invoices
  set subtotal_cents = v_total, total_cents = v_total
  where id = p_invoice_id;
end;
$$;

alter table invoice_line_items drop column if exists line_type;

drop policy if exists "credits_select_own" on credits;
drop table if exists credits;

alter table sessions
  drop column if exists cancellation_handling,
  drop column if exists cancelled_at;

alter table tutors
  drop column if exists cancellation_window_hours,
  drop column if exists default_cancellation_policy;
