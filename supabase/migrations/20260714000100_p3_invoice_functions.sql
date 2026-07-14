-- P3: invoice lifecycle as SECURITY DEFINER functions — the sanctioned,
-- exclusive write path for invoices/invoice_line_items (see previous
-- migration: those tables have no direct-client write RLS policy at all).
-- Each function re-derives its own authorization from auth.uid() via
-- current_tutor_id(), so security does not depend on RLS here — it depends
-- on every function checking ownership and state itself, which is why each
-- guard below is written as a single atomic UPDATE ... WHERE (not a
-- SELECT-then-UPDATE) or a row lock, so concurrent calls can't race past a
-- check that's already stale by the time the write happens.
-- search_path is pinned (required for SECURITY DEFINER safety).

create function current_tutor_id()
returns uuid
language sql
security invoker
set search_path = public
stable
as $$
  select id from tutors where auth_user_id = auth.uid()
$$;

create function session_amount_cents(
  p_duration_minutes integer,
  p_travel_minutes integer,
  p_effective_rate_cents integer,
  p_bill_travel boolean,
  p_travel_rate_cents integer
)
returns integer
language sql
security invoker
set search_path = public
immutable
as $$
  select round(
    (p_duration_minutes::numeric / 60) * p_effective_rate_cents
    + case when p_bill_travel then (p_travel_minutes::numeric / 60) * coalesce(p_travel_rate_cents, 0) else 0 end
  )::integer
$$;

-- Locks the invoice row for the remainder of the calling transaction before
-- re-deriving the total, so two concurrent line-item mutations on the same
-- invoice serialize instead of one clobbering the other's contribution.
create function recompute_invoice_totals(p_invoice_id uuid)
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

create function create_draft_invoice(
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

  -- FOR UPDATE locks each matching session row. A concurrent call racing on
  -- the same sessions blocks here until this transaction commits (claiming
  -- invoice_id), at which point its own row re-fetch sees invoice_id is no
  -- longer null and the row drops out of its result set — so the same
  -- session can never end up claimed by two invoices.
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
        v_session.travel_rate_cents
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

create function add_manual_line_item(
  p_invoice_id uuid,
  p_description text,
  p_amount_cents integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line_id uuid;
begin
  if p_amount_cents <= 0 then
    raise exception 'Amount must be greater than zero.';
  end if;

  if not exists (
    select 1 from invoices
    where id = p_invoice_id and tutor_id = current_tutor_id() and status = 'draft'
  ) then
    raise exception 'Invoice not found or not editable.';
  end if;

  insert into invoice_line_items (invoice_id, session_id, description, quantity_minutes, amount_cents)
  values (p_invoice_id, null, p_description, null, p_amount_cents)
  returning id into v_line_id;

  perform recompute_invoice_totals(p_invoice_id);

  return v_line_id;
end;
$$;

create function remove_line_item(p_line_item_id uuid)
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

create function send_invoice(p_invoice_id uuid)
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

  -- Single atomic guarded UPDATE: the WHERE clause (status = 'draft' + has
  -- a line item) is evaluated as part of this statement, not a prior
  -- SELECT, so a concurrent send on the same invoice can't both pass.
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

create function void_invoice(p_invoice_id uuid)
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

create function mark_invoice_paid(p_invoice_id uuid, p_method text)
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

-- Scope RPC execution to authenticated users only (revoke the default
-- PUBLIC grant new functions get). SECURITY DEFINER functions still need
-- their own EXECUTE grant per role regardless of security mode.
revoke execute on function current_tutor_id() from public;
revoke execute on function session_amount_cents(integer, integer, integer, boolean, integer) from public;
revoke execute on function recompute_invoice_totals(uuid) from public;
revoke execute on function create_draft_invoice(uuid, date, date) from public;
revoke execute on function add_manual_line_item(uuid, text, integer) from public;
revoke execute on function remove_line_item(uuid) from public;
revoke execute on function send_invoice(uuid) from public;
revoke execute on function void_invoice(uuid) from public;
revoke execute on function mark_invoice_paid(uuid, text) from public;

grant execute on function current_tutor_id() to authenticated;
grant execute on function session_amount_cents(integer, integer, integer, boolean, integer) to authenticated;
grant execute on function recompute_invoice_totals(uuid) to authenticated;
grant execute on function create_draft_invoice(uuid, date, date) to authenticated;
grant execute on function add_manual_line_item(uuid, text, integer) to authenticated;
grant execute on function remove_line_item(uuid) to authenticated;
grant execute on function send_invoice(uuid) to authenticated;
grant execute on function void_invoice(uuid) to authenticated;
grant execute on function mark_invoice_paid(uuid, text) to authenticated;
