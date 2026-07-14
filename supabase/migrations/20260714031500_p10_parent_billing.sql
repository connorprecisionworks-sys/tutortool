-- P10: parent billing view. Parents see their own children's invoices and
-- pay via the Stripe payment link generated in P4.
--
-- Unlike sessions (P7's parent_visible_sessions view hides
-- effective_rate_cents/travel_rate_cents/bill_travel — "rate internals"),
-- invoices carries no per-hour rate breakdown, only totals and line-item
-- amounts — exactly what the payer is being asked to pay. That's the whole
-- point of a bill, so a plain RLS SELECT policy (same is_parent_of_student()
-- helper used everywhere else in the parent-visibility chain) is enough
-- here; no view/column-filtering layer needed like P7 required.
--
-- Draft invoices are deliberately excluded: a draft is the tutor's
-- in-progress workspace (lines still being added/removed) and was never
-- sent, so a parent has no business seeing it yet.

create policy "invoices_select_parent" on invoices
  for select using (status <> 'draft' and is_parent_of_student(client_id));

create policy "invoice_line_items_select_parent" on invoice_line_items
  for select using (
    exists (
      select 1 from invoices
      where invoices.id = invoice_line_items.invoice_id
        and invoices.status <> 'draft'
        and is_parent_of_student(invoices.client_id)
    )
  );
