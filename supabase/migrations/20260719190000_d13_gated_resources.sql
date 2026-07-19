-- D13: gated / paid resources + invoice add-ons.
--
-- A tutor can mark any resource as gated with a price (resource_gates,
-- 1:1 with resources). Payment happens through the existing invoice/Stripe
-- pipeline: the tutor attaches a locked gate to a draft invoice as a line
-- item (add_gated_resource_line_item), and paying that invoice (Stripe or
-- manual mark-as-paid) unlocks it — mirrors Q5/D8's package activation
-- pattern (activate_package_for_invoice) exactly, including the same
-- idempotent "self-guard on invoices.status = 'paid'" trick so this can be
-- safely called from both mark_invoice_paid() and the Stripe webhook (which
-- has no tutor session, just the service-role admin client).
--
-- The real access-control problem: RLS is row-level, not column-level. A
-- parent must be able to SEE that a locked resource exists (title, price)
-- but must NOT be able to read its url_or_path (for a 'link' resource
-- that value IS the resource; for 'file' it's the storage path needed to
-- mint a signed URL) before paying. The existing resources_select_parent
-- policy (P8) grants the parent role full-row SELECT, which no per-column
-- USING clause can narrow — so it's dropped here and replaced with two
-- SECURITY DEFINER functions (get_parent_resources / get_parent_resource_url)
-- that null out url_or_path whenever a gate is locked. Every parent-facing
-- resource read goes through one of these now; a parent's own Supabase
-- client can no longer SELECT the resources table directly at all, closing
-- the "call the RPC from the app but query the table directly from
-- devtools" bypass. The tutor's own resources_select_own/update/insert/
-- delete policies are untouched — a tutor always sees their own resources
-- in full, gated or not.

create table resource_gates (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references resources (id) on delete cascade unique,
  price_cents integer not null check (price_cents > 0),
  status text not null default 'locked' check (status in ('locked', 'unlocked')),
  -- Which invoice/line-item is currently carrying this gate's charge, if
  -- any. Both go back to null automatically (ON DELETE SET NULL) if that
  -- invoice/line is ever deleted (delete_draft_invoice) — see also
  -- remove_line_item and void_invoice below, which clear them explicitly
  -- on a still-locked detach so the gate becomes attachable again without
  -- waiting on a row delete.
  unlock_invoice_id uuid references invoices (id) on delete set null,
  unlock_line_item_id uuid references invoice_line_items (id) on delete set null,
  unlocked_at timestamptz,
  created_at timestamptz not null default now()
);

create index resource_gates_resource_id_idx on resource_gates (resource_id);
create index resource_gates_unlock_invoice_id_idx on resource_gates (unlock_invoice_id);

alter table resource_gates enable row level security;

-- Tutor-only SELECT (own resources' gates) so the Resources page can render
-- price/status. No insert/update/delete policy — this is a money-adjacent
-- state machine (see money_mutation_architecture), writes only happen
-- through the SECURITY DEFINER functions below.
create policy "resource_gates_select_own" on resource_gates
  for select using (
    resource_id in (
      select id from resources where tutor_id in (select id from tutors where auth_user_id = auth.uid())
    )
  );

drop policy "resources_select_parent" on resources;

create function get_parent_resources()
returns table (
  id uuid,
  student_id uuid,
  student_name text,
  title text,
  type resource_type,
  url_or_path text,
  created_at timestamptz,
  gate_status text,
  gate_price_cents integer
)
language sql
security definer
set search_path = public
stable
as $$
  select
    r.id,
    r.student_id,
    c.student_name,
    r.title,
    r.type,
    case when g.id is null or g.status = 'unlocked' then r.url_or_path else null end,
    r.created_at,
    g.status,
    g.price_cents
  from resources r
  join clients c on c.id = r.student_id
  left join resource_gates g on g.resource_id = r.id
  where is_parent_of_student(r.student_id)
  order by r.created_at desc
$$;

-- Single-resource counterpart used by getResourceUrlAction's parent path.
-- Deliberately re-checks is_parent_of_student itself (not just relying on
-- get_parent_resources having already filtered a list) since this is a
-- distinct entry point a parent's client could call directly with any id.
create function get_parent_resource_url(p_resource_id uuid)
returns table (type resource_type, url_or_path text, locked boolean)
language sql
security definer
set search_path = public
stable
as $$
  select
    r.type,
    case when g.id is null or g.status = 'unlocked' then r.url_or_path else null end,
    coalesce(g.status = 'locked', false)
  from resources r
  left join resource_gates g on g.resource_id = r.id
  where r.id = p_resource_id
    and is_parent_of_student(r.student_id)
$$;

revoke execute on function get_parent_resources() from public;
revoke execute on function get_parent_resources() from anon;
grant execute on function get_parent_resources() to authenticated;

revoke execute on function get_parent_resource_url(uuid) from public;
revoke execute on function get_parent_resource_url(uuid) from anon;
grant execute on function get_parent_resource_url(uuid) to authenticated;

-- Tutor-facing gate management. All three re-derive tutor scope from
-- current_tutor_id(), same convention as every other invoice/money function.

create function set_resource_gate(p_resource_id uuid, p_price_cents integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
  v_gate_id uuid;
begin
  if v_tutor_id is null then
    raise exception 'Not authorized.';
  end if;
  if p_price_cents <= 0 then
    raise exception 'Price must be greater than zero.';
  end if;
  if not exists (select 1 from resources where id = p_resource_id and tutor_id = v_tutor_id) then
    raise exception 'Resource not found.';
  end if;

  select id into v_gate_id from resource_gates where resource_id = p_resource_id;

  if v_gate_id is not null then
    if exists (select 1 from resource_gates where id = v_gate_id and (status = 'unlocked' or unlock_invoice_id is not null)) then
      raise exception 'This resource is already attached to an invoice or already unlocked — remove it from the invoice first to change the price.';
    end if;
    update resource_gates set price_cents = p_price_cents where id = v_gate_id;
    return v_gate_id;
  end if;

  insert into resource_gates (resource_id, price_cents)
  values (p_resource_id, p_price_cents)
  returning id into v_gate_id;

  return v_gate_id;
end;
$$;

create function remove_resource_gate(p_resource_id uuid)
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

  if not exists (select 1 from resources where id = p_resource_id and tutor_id = v_tutor_id) then
    raise exception 'Resource not found.';
  end if;

  if exists (
    select 1 from resource_gates
    where resource_id = p_resource_id and (status = 'unlocked' or unlock_invoice_id is not null)
  ) then
    raise exception 'This resource is already attached to an invoice or already unlocked — remove it from the invoice first.';
  end if;

  delete from resource_gates where resource_id = p_resource_id;
end;
$$;

-- Manual comp/waive unlock — "mark as paid also unlocks", independent of
-- any invoice.
create function manually_unlock_resource_gate(p_gate_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update resource_gates
  set status = 'unlocked', unlocked_at = now()
  where id = p_gate_id
    and status = 'locked'
    and resource_id in (select id from resources where tutor_id = current_tutor_id());

  if not found then
    raise exception 'Gate not found or already unlocked.';
  end if;
end;
$$;

-- Attaches a locked, unattached gate to a draft invoice as a manual charge
-- line — same shape as add_manual_line_item, plus linking the gate back to
-- the new line/invoice so unlock_gated_resources_for_invoice (below) and
-- remove_line_item/void_invoice know what to revert if it's removed/voided
-- before payment.
create function add_gated_resource_line_item(p_invoice_id uuid, p_resource_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
  v_client_id uuid;
  v_gate resource_gates%rowtype;
  v_resource_title text;
  v_line_id uuid;
begin
  if v_tutor_id is null then
    raise exception 'Not authorized.';
  end if;

  select client_id into v_client_id from invoices
  where id = p_invoice_id and tutor_id = v_tutor_id and status = 'draft';
  if v_client_id is null then
    raise exception 'Invoice not found or not editable.';
  end if;

  select r.title into v_resource_title
  from resources r
  where r.id = p_resource_id and r.tutor_id = v_tutor_id and r.student_id = v_client_id;
  if v_resource_title is null then
    raise exception 'Resource not found for this student.';
  end if;

  select * into v_gate from resource_gates where resource_id = p_resource_id for update;
  if v_gate.id is null then
    raise exception 'This resource has no price set.';
  end if;
  if v_gate.status != 'locked' or v_gate.unlock_invoice_id is not null then
    raise exception 'This resource is already unlocked or already on another invoice.';
  end if;

  insert into invoice_line_items (invoice_id, session_id, description, quantity_minutes, amount_cents, line_type)
  values (p_invoice_id, null, 'Unlock: ' || v_resource_title, null, v_gate.price_cents, 'charge')
  returning id into v_line_id;

  update resource_gates
  set unlock_invoice_id = p_invoice_id, unlock_line_item_id = v_line_id
  where id = v_gate.id;

  perform recompute_invoice_totals(p_invoice_id);

  return v_line_id;
end;
$$;

-- Shared by mark_invoice_paid and the Stripe webhook, exact same pattern as
-- activate_package_for_invoice: self-guards on invoices.status = 'paid', so
-- granting it to `authenticated` (required for mark_invoice_paid to call it)
-- can never unlock anything for free — only an invoice genuinely already
-- paid in the database can trigger it, calling early/out-of-band is a no-op.
create function unlock_gated_resources_for_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from invoices where id = p_invoice_id and status = 'paid') then
    return;
  end if;

  update resource_gates
  set status = 'unlocked', unlocked_at = now()
  where unlock_invoice_id = p_invoice_id and status = 'locked';
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

  perform activate_package_for_invoice(p_invoice_id);
  perform unlock_gated_resources_for_invoice(p_invoice_id);
end;
$$;

-- remove_line_item: extends Q4's credit-line guard with the gated-resource
-- case. Once unlocked (paid), the line can never be removed (would let a
-- tutor un-invoice something a parent already paid for and unlocked, with
-- no reconciliation). Still-locked (unpaid, e.g. tutor changed their mind
-- before send) detaches cleanly: the gate reverts to unattached, available
-- to attach to a different invoice.
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
  v_gate resource_gates%rowtype;
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

  select * into v_gate from resource_gates where unlock_line_item_id = p_line_item_id;
  if v_gate.id is not null then
    if v_gate.status = 'unlocked' then
      raise exception 'This resource has already been unlocked and paid for — it can''t be removed from the invoice.';
    end if;
    update resource_gates set unlock_invoice_id = null, unlock_line_item_id = null where id = v_gate.id;
  end if;

  if v_session_id is not null then
    update sessions set invoice_id = null where id = v_session_id;
  end if;

  delete from invoice_line_items where id = p_line_item_id;

  perform recompute_invoice_totals(v_invoice_id);
end;
$$;

-- void_invoice: detaches any still-locked gated-resource lines on the
-- voided invoice (mirrors D8's package-cancel-on-void), freeing them to
-- attach elsewhere. An already-unlocked (paid) gate is untouched — voiding
-- an invoice after its gated content was already paid for and unlocked
-- must never re-lock it.
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

  update resource_gates
  set unlock_invoice_id = null, unlock_line_item_id = null
  where unlock_invoice_id = p_invoice_id and status = 'locked';

  update sessions set invoice_id = null, status = 'logged' where invoice_id = p_invoice_id;
end;
$$;

revoke execute on function set_resource_gate(uuid, integer) from public;
revoke execute on function remove_resource_gate(uuid) from public;
revoke execute on function manually_unlock_resource_gate(uuid) from public;
revoke execute on function add_gated_resource_line_item(uuid, uuid) from public;
revoke execute on function unlock_gated_resources_for_invoice(uuid) from public;

grant execute on function set_resource_gate(uuid, integer) to authenticated;
grant execute on function remove_resource_gate(uuid) to authenticated;
grant execute on function manually_unlock_resource_gate(uuid) to authenticated;
grant execute on function add_gated_resource_line_item(uuid, uuid) to authenticated;
grant execute on function unlock_gated_resources_for_invoice(uuid) to authenticated;
