-- P4: Stripe webhook idempotency + the one sanctioned client write path for
-- persisting a Stripe payment link onto an invoice (same "no direct-client
-- write RLS, SECURITY DEFINER function re-derives its own auth" pattern as
-- P3 — see money_mutation_architecture note).

create table stripe_webhook_events (
  id text primary key, -- Stripe event id, e.g. evt_...
  event_type text not null,
  processed_at timestamptz not null default now()
);

-- No RLS policies at all: this table is only ever touched by the webhook
-- route using the service-role admin client, which bypasses RLS by design.
-- Enabling RLS with zero policies means even a hypothetical anon/authenticated
-- caller gets a hard default-deny on every operation.
alter table stripe_webhook_events enable row level security;

create function set_invoice_stripe_link(
  p_invoice_id uuid,
  p_stripe_checkout_session_id text,
  p_stripe_payment_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update invoices
  set stripe_invoice_id = p_stripe_checkout_session_id,
      stripe_payment_url = p_stripe_payment_url
  where id = p_invoice_id
    and tutor_id = current_tutor_id()
    and status in ('sent', 'overdue');

  if not found then
    raise exception 'Invoice not found or not in a state that accepts a payment link.';
  end if;
end;
$$;

revoke execute on function set_invoice_stripe_link(uuid, text, text) from public;
grant execute on function set_invoice_stripe_link(uuid, text, text) to authenticated;
