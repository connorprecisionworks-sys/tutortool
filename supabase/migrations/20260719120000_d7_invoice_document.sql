-- D7: printable/PDF invoice view, shared by the tutor and parent shells at
-- a single top-level route (/invoice/[id], no dashboard chrome). Needs its
-- own authorization check rather than relying on ambient RLS: a parent
-- viewing this page has no RLS grant to read the `tutors` table at all
-- (tutors_select_own is tutor-only), so the tutor branding info (name,
-- contact) can't come from a plain client-side select the way the tutor's
-- own view of the same page could. Same visibility rule as the two
-- existing invoices SELECT policies, just evaluated once here instead of
-- relying on RLS row-filtering across a join it can't cross: the owning
-- tutor sees any status (including drafts, for their own preview/proofing
-- use), a linked parent only sees non-draft invoices.
create or replace function get_invoice_document(p_invoice_id uuid)
returns json
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_invoice invoices%rowtype;
  v_tutor tutors%rowtype;
  v_client clients%rowtype;
  v_line_items json;
begin
  select * into v_invoice from invoices where id = p_invoice_id;
  if v_invoice.id is null then
    return json_build_object('found', false);
  end if;

  if not (
    v_invoice.tutor_id = current_tutor_id()
    or (v_invoice.status <> 'draft' and is_parent_of_student(v_invoice.client_id))
  ) then
    return json_build_object('found', false);
  end if;

  select * into v_tutor from tutors where id = v_invoice.tutor_id;
  select * into v_client from clients where id = v_invoice.client_id;

  -- line_type is included so the document can render a credit line the
  -- same way every other invoice view in the app does (a "−" prefix, since
  -- amount_cents itself is always stored positive regardless of line_type
  -- — see app/tutor/invoices/[id]/page.tsx's isCredit handling).
  select coalesce(
    json_agg(
      json_build_object('description', li.description, 'amount_cents', li.amount_cents, 'line_type', li.line_type)
      order by li.created_at
    ),
    '[]'::json
  )
  into v_line_items
  from invoice_line_items li
  where li.invoice_id = p_invoice_id;

  return json_build_object(
    'found', true,
    'invoice', json_build_object(
      'id', v_invoice.id,
      'period_start', v_invoice.period_start,
      'period_end', v_invoice.period_end,
      'status', v_invoice.status,
      'due_date', v_invoice.due_date,
      'sent_at', v_invoice.sent_at,
      'paid_at', v_invoice.paid_at,
      'paid_method', v_invoice.paid_method,
      'subtotal_cents', v_invoice.subtotal_cents,
      'total_cents', v_invoice.total_cents
    ),
    'tutor', json_build_object(
      'name', coalesce(nullif(btrim(v_tutor.public_display_name), ''), v_tutor.name),
      'email', v_tutor.email,
      'phone', case when v_tutor.show_phone then v_tutor.phone else null end
    ),
    'client', json_build_object(
      'student_name', v_client.student_name,
      'payer_name', v_client.payer_name,
      'payer_email', v_client.payer_email
    ),
    'line_items', v_line_items
  );
end;
$$;

revoke execute on function get_invoice_document(uuid) from public;
grant execute on function get_invoice_document(uuid) to authenticated;
