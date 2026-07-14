-- Rollback for 20260714000100_p3_invoice_functions.sql

drop function if exists mark_invoice_paid(uuid, text);
drop function if exists void_invoice(uuid);
drop function if exists send_invoice(uuid);
drop function if exists remove_line_item(uuid);
drop function if exists add_manual_line_item(uuid, text, integer);
drop function if exists create_draft_invoice(uuid, date, date);
drop function if exists recompute_invoice_totals(uuid);
drop function if exists session_amount_cents(integer, integer, integer, boolean, integer);
drop function if exists current_tutor_id();
