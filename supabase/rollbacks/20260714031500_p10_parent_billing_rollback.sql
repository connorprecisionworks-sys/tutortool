-- Rollback for 20260714031500_p10_parent_billing.sql

drop policy if exists "invoice_line_items_select_parent" on invoice_line_items;
drop policy if exists "invoices_select_parent" on invoices;
