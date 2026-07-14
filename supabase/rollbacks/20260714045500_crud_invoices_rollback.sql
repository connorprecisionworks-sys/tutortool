-- Rollback for 20260714045500_crud_invoices.sql

revoke execute on function delete_draft_invoice(uuid) from authenticated;
drop function if exists delete_draft_invoice(uuid);
