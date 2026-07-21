-- Security review finding: recompute_invoice_totals is SECURITY DEFINER,
-- granted to `authenticated`, and (unlike every other money-mutating
-- function in this codebase) never re-derives/checks which tutor's invoice
-- it's touching — callable via supabase.rpc('recompute_invoice_totals', ...)
-- against ANY invoice id in the system by any signed-in user (tutor or
-- parent). Not currently exploitable to corrupt data (invoice_line_items
-- can only be mutated while draft, and every draft-mutating path already
-- calls this same recompute in the same transaction, so an out-of-band call
-- is a same-value no-op today) — but it's a real deviation from this
-- codebase's own SECURITY DEFINER pattern and would become an actual
-- cross-tenant billing-manipulation vector the moment any future code path
-- touches invoice_line_items outside the draft-only functions.
--
-- Fix: check ownership only when the caller is an authenticated end user
-- (auth.uid() is not null) — auto-invoice's service-role call path
-- (run_client_auto_invoice, called via the admin/service-role client with no
-- auth.uid()) must keep working unauthenticated-by-user, exactly like every
-- other nested `perform recompute_invoice_totals(...)` call already does.
-- Preserves the original silent-no-op-if-invoice-missing behavior; only adds
-- the ownership check.
create or replace function recompute_invoice_totals(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subtotal integer;
  v_credit integer;
  v_tutor_id uuid;
begin
  select tutor_id into v_tutor_id
  from invoices where id = p_invoice_id for update;

  if v_tutor_id is null then
    return;
  end if;

  if auth.uid() is not null and v_tutor_id <> current_tutor_id() then
    raise exception 'Not authorized.';
  end if;

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
