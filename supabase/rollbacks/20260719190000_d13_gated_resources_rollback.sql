-- Rollback D13: gated / paid resources + invoice add-ons.
-- Restores remove_line_item/void_invoice/mark_invoice_paid to their pre-D13
-- bodies (Q4/Q5's versions), restores the resources_select_parent policy,
-- then drops the new functions/table.

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

create policy "resources_select_parent" on resources
  for select using (is_parent_of_student(student_id));

drop function if exists unlock_gated_resources_for_invoice(uuid);
drop function if exists add_gated_resource_line_item(uuid, uuid);
drop function if exists manually_unlock_resource_gate(uuid);
drop function if exists remove_resource_gate(uuid);
drop function if exists set_resource_gate(uuid, integer);
drop function if exists get_parent_resource_url(uuid);
drop function if exists get_parent_resources();

drop table if exists resource_gates;
