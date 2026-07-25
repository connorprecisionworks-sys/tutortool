-- NOT YET APPLIED.
--
-- QA follow-up to sec5 (20260724110000_sec5_invoice_checkout_session_lock.sql):
-- session_lock_at was only ever cleared on the success path, inside
-- set_invoice_stripe_link's writeBack. Every error exit in
-- createInvoiceCheckoutSession *after* the lease is claimed (the Stripe
-- create call throwing, session.url coming back falsy, or the writeBack
-- itself failing) left the lease set — a failed Stripe call would soft-lock
-- that invoice for up to the full 30s lease window, and a retry inside that
-- window would show the misleading "a payment link is already being
-- generated" message even though nothing is actually in flight. This adds
-- the matching release function so lib/stripe-checkout-session.ts can clear
-- its own lease on every failure path, not just success.
create or replace function release_invoice_checkout_session_lock(p_invoice_id uuid, p_claimed_at timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid;
begin
  select tutor_id into v_tutor_id from invoices where id = p_invoice_id;
  if v_tutor_id is null then
    return;
  end if;

  if auth.uid() is not null and v_tutor_id <> current_tutor_id() then
    raise exception 'Not authorized.';
  end if;

  -- Guarded by the caller's own claimed timestamp, not just the invoice id:
  -- if this lease already expired (>30s) and a later caller re-claimed it,
  -- session_lock_at no longer equals p_claimed_at, so this is a no-op —
  -- a slow/stuck caller releasing late can never clear someone else's live
  -- lease out from under them.
  update invoices
  set session_lock_at = null
  where id = p_invoice_id
    and session_lock_at = p_claimed_at;
end;
$$;

-- Same broad-caller rationale as claim_invoice_checkout_session_lock: needs
-- to work for both the tutor-facing RLS-scoped client (authenticated) and
-- the auto-invoice service-role admin client (service_role, no auth.uid()).
-- Revoking from `public` alone can still leave `anon`/`authenticated`
-- able to call a function on this project (grants inherited through PUBLIC
-- aren't fully removed by a public-only revoke here) — revoke from each
-- role explicitly and verify with has_function_privilege() if unsure.
revoke execute on function release_invoice_checkout_session_lock(uuid, timestamptz) from public, anon;
grant execute on function release_invoice_checkout_session_lock(uuid, timestamptz) to authenticated, service_role;
