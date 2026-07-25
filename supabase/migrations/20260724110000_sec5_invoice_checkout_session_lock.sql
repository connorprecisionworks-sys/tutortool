-- QA follow-up: the sec-review Stripe fix (expire-then-create, see
-- app/tutor/invoices/actions.ts / lib/auto-invoice.ts history) closes the
-- *sequential* double-Checkout-Session case (an old link left open, then a
-- tutor regenerates) but not a *concurrent* one — two overlapping calls for
-- the same invoice (a double-click, two tabs, a retried request) can both
-- read the same pre-expire state and both mint a live session before either
-- writes back. This adds a short-lived lease column plus an atomic
-- claim-or-fail function so only one concurrent caller ever proceeds past
-- the claim point; the loser is told to retry rather than racing ahead.
alter table invoices add column session_lock_at timestamptz;

-- Atomic claim: a single UPDATE...WHERE is one statement, so two concurrent
-- callers serialize on Postgres's row lock — the second one's WHERE clause
-- re-evaluates against the first's already-committed write and fails to
-- match, exactly like check_rate_limit's insert...on conflict avoids a
-- separate select-then-update TOCTOU race (see sec3). 30s default lease is
-- comfortably longer than a Checkout Session create call should ever take,
-- short enough that a caller that died mid-flight (crash, timeout) without
-- clearing the lease doesn't wedge the invoice for long. Returns the
-- claimed timestamp (used by callers as part of a Stripe idempotencyKey) or
-- null if the claim failed.
--
-- Ownership check mirrors recompute_invoice_totals (sec2): only enforced
-- when the caller is an authenticated end user (auth.uid() is not null) —
-- auto-invoice's service-role call path (lib/auto-invoice.ts, no
-- auth.uid()) must keep working unauthenticated-by-user. Belt-and-suspenders
-- here specifically: the tutor-facing caller (app/tutor/invoices/actions.ts)
-- only ever reaches this function for an invoice its own RLS-scoped read
-- already resolved (invoices_select_own), so a cross-tenant invoiceId can't
-- actually get here today, but this keeps the function safe to call on its
-- own, not dependent on every future caller replicating that guarantee.
create or replace function claim_invoice_checkout_session_lock(p_invoice_id uuid, p_stale_after_seconds integer default 30)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid;
  v_claimed_at timestamptz := now();
begin
  select tutor_id into v_tutor_id from invoices where id = p_invoice_id;
  if v_tutor_id is null then
    return null;
  end if;

  if auth.uid() is not null and v_tutor_id <> current_tutor_id() then
    raise exception 'Not authorized.';
  end if;

  update invoices
  set session_lock_at = v_claimed_at
  where id = p_invoice_id
    and (session_lock_at is null or session_lock_at < v_claimed_at - make_interval(secs => p_stale_after_seconds));

  if not found then
    return null;
  end if;

  return v_claimed_at;
end;
$$;

revoke execute on function claim_invoice_checkout_session_lock(uuid, integer) from public;
grant execute on function claim_invoice_checkout_session_lock(uuid, integer) to authenticated, service_role;

-- Release the lease once the claimed session id is actually written back,
-- so a successful regenerate doesn't leave the next legitimate attempt
-- waiting out the rest of the 30s lease unnecessarily. The service-role
-- write path (lib/auto-invoice.ts) clears its own copy of this column
-- directly in its plain admin `update` — it doesn't go through this
-- function at all (see that function's own comment for why).
create or replace function set_invoice_stripe_link(
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
      stripe_payment_url = p_stripe_payment_url,
      session_lock_at = null
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
