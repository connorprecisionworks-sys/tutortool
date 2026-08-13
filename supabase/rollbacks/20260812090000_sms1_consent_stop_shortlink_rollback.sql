-- Rollback for SMS1.
--
-- Restores get_invoice_document to its self-contained D7 form before
-- dropping the shared payload function, so the invoice document page keeps
-- working throughout.
--
-- DELIBERATELY NOT A FULL REVERT: the coalesce(..., false) in the guard
-- below is kept. The D7 original let any signed-in non-tutor read any
-- invoice by id (current_tutor_id() is NULL for them, and a NULL IF
-- condition skips the deny branch) — see the SECURITY FIX note in the
-- forward migration. Rolling back the SMS feature must not re-open that.

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

  if not coalesce(
    v_invoice.tutor_id = current_tutor_id()
    or (v_invoice.status <> 'draft' and is_parent_of_student(v_invoice.client_id)),
    false
  ) then
    return json_build_object('found', false);
  end if;

  select * into v_tutor from tutors where id = v_invoice.tutor_id;
  select * into v_client from clients where id = v_invoice.client_id;

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

drop function if exists get_invoice_document_by_token(text);
drop function if exists _invoice_document_payload(uuid);

alter table invoices alter column short_token drop not null;
alter table invoices alter column short_token drop default;
alter table invoices drop column short_token;
drop function if exists gen_invoice_short_token();

drop trigger if exists clients_stamp_sms_consent on clients;
drop function if exists stamp_sms_consent();
drop function if exists current_sms_consent_text();
drop function if exists record_sms_opt_out(text);
drop function if exists record_sms_opt_in(text);

alter table clients drop column sms_consent_at;
alter table clients drop column sms_consent_text;
alter table clients drop column sms_opt_out_at;
