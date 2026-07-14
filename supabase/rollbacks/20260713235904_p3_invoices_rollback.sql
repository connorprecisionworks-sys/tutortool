-- Rollback for 20260713235904_p3_invoices.sql

drop policy if exists "invoice_line_items_delete_own" on invoice_line_items;
drop policy if exists "invoice_line_items_update_own" on invoice_line_items;
drop policy if exists "invoice_line_items_insert_own" on invoice_line_items;
drop policy if exists "invoice_line_items_select_own" on invoice_line_items;
drop policy if exists "invoices_delete_own" on invoices;
drop policy if exists "invoices_update_own" on invoices;
drop policy if exists "invoices_insert_own" on invoices;
drop policy if exists "invoices_select_own" on invoices;

drop index if exists invoice_line_items_session_id_idx;
drop index if exists invoice_line_items_invoice_id_idx;
drop index if exists invoices_status_idx;
drop index if exists invoices_client_id_idx;
drop index if exists invoices_tutor_id_idx;

alter table sessions drop constraint if exists sessions_invoice_id_fkey;

drop table if exists invoice_line_items;
drop table if exists invoices;

drop type if exists invoice_status;
