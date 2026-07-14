-- Rollback for 20260714005617_p4_stripe.sql

drop function if exists set_invoice_stripe_link(uuid, text, text);
drop table if exists stripe_webhook_events;
