import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe, getStripeAccountStatus, isStripeConfigured } from "@/lib/stripe/client";
import { appUrl } from "@/lib/env";

export interface CreateCheckoutSessionResult {
  error?: string;
}

/**
 * Shared by the tutor-facing (RLS-scoped client, app/tutor/invoices/actions.ts)
 * and auto-invoice (service-role admin client, lib/auto-invoice.ts) payment-link
 * flows — the two previously near-duplicated this whole body and differed only
 * in which client they read/write through and how the final link gets
 * persisted (the current_tutor_id()-gated set_invoice_stripe_link RPC, vs a
 * direct admin update bypassing RLS), so this takes a small writeBack callback
 * rather than forking the function. Never throws — a Stripe hiccup shouldn't
 * undo a successful invoice send; callers still have the manual mark-as-paid
 * fallback.
 *
 * Concurrency-safe: claims a lease (claim_invoice_checkout_session_lock, see
 * supabase/migrations/20260724110000_sec5_invoice_checkout_session_lock.sql —
 * NOT YET APPLIED) before touching Stripe, so two overlapping calls for the
 * same invoice (a double-click, two tabs, a retried request) can't both mint
 * a live Checkout Session — the atomic UPDATE...WHERE inside that function
 * means only one caller ever wins the claim; the other gets told to retry
 * rather than racing ahead. Also passes Stripe an idempotencyKey derived
 * from the claimed lease timestamp as a second, independent layer: that
 * protects against a retry of *this same already-claimed call* (e.g. the
 * Stripe response is lost to a network error and something resubmits),
 * which the lease alone doesn't cover once it's already been won.
 *
 * Every exit after a successful claim releases the lease one way or
 * another: the success path clears it via writeBack (set_invoice_stripe_link
 * nulls session_lock_at), every other exit clears it via
 * release_invoice_checkout_session_lock (see
 * supabase/migrations/20260724130000_sec7_release_checkout_session_lock.sql
 * — NOT YET APPLIED) in a finally block, so a failed Stripe call doesn't
 * soft-lock the invoice for the rest of the 30s lease window.
 */
export async function createInvoiceCheckoutSession(
  supabase: SupabaseClient,
  invoiceId: string,
  writeBack: (session: { id: string; url: string }) => Promise<{ error?: string }>
): Promise<CreateCheckoutSessionResult> {
  if (!isStripeConfigured()) return {};

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, tutors(stripe_account_id), clients(payer_email, student_name)")
    .eq("id", invoiceId)
    .maybeSingle();

  const tutorRow = invoice?.tutors as unknown as { stripe_account_id: string | null } | null;
  const clientRow = invoice?.clients as unknown as { payer_email: string | null; student_name: string } | null;
  if (!invoice || !tutorRow?.stripe_account_id) return {};
  // Only a sent/overdue invoice is payable — never mint a fresh live
  // Checkout Session against a paid/void/draft invoice.
  if (invoice.status !== "sent" && invoice.status !== "overdue") {
    return { error: "This invoice can no longer accept a payment link." };
  }

  const status = await getStripeAccountStatus(tutorRow.stripe_account_id);
  if (!status?.chargesEnabled) return {};

  const { data: lockTimestamp, error: lockError } = await supabase.rpc("claim_invoice_checkout_session_lock", {
    p_invoice_id: invoiceId,
  });
  if (lockError) {
    console.error(`claim_invoice_checkout_session_lock failed for invoice ${invoiceId}:`, lockError.message);
    return { error: "Couldn't generate a payment link right now — try again in a moment." };
  }
  if (!lockTimestamp) {
    // Someone else (a concurrent click, a second tab, an overlapping
    // request) already holds the lease for this invoice — friendly retry
    // message, not a crash. The lease auto-expires after 30s (see the
    // migration) so this can never wedge an invoice if a prior attempt
    // died mid-flight without clearing it.
    return { error: "A payment link is already being generated for this invoice — try again in a moment." };
  }

  // From here on, every exit must leave the lease either advanced to a real
  // link (writeBack's own session_lock_at = null, on success) or explicitly
  // released below — otherwise a failed attempt soft-locks this invoice for
  // the rest of the 30s window and a retry sees a misleading "already being
  // generated" message for no reason.
  try {
    // Expire any still-open prior Checkout Session for this invoice first, so
    // at most one live session can ever accept payment for it at a time.
    if (invoice.stripe_invoice_id) {
      try {
        const stripe = getStripe();
        await stripe.checkout.sessions.expire(
          invoice.stripe_invoice_id,
          {},
          { stripeAccount: tutorRow.stripe_account_id }
        );
      } catch {
        // Already expired/completed/gone — fine, proceed to mint a new one.
      }
    }

    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: { name: `Tutoring — ${clientRow?.student_name ?? "invoice"}` },
                unit_amount: invoice.total_cents,
              },
              quantity: 1,
            },
          ],
          customer_email: clientRow?.payer_email ?? undefined,
          metadata: { invoice_id: invoiceId },
          success_url: `${appUrl()}/tutor/invoices/${invoiceId}?stripe=success`,
          cancel_url: `${appUrl()}/tutor/invoices/${invoiceId}?stripe=cancelled`,
        },
        {
          stripeAccount: tutorRow.stripe_account_id,
          idempotencyKey: `invoice_${invoiceId}_${lockTimestamp}`,
        }
      );

      if (session.url) {
        const writeBackResult = await writeBack({ id: session.id, url: session.url });
        if (writeBackResult.error) {
          console.error(`writeBack failed for invoice ${invoiceId}:`, writeBackResult.error);
          return writeBackResult;
        }
      }
      return {};
    } catch (err) {
      const message = err instanceof Error ? err.message : "Stripe error creating the payment link.";
      console.error(`createInvoiceCheckoutSession failed for invoice ${invoiceId}:`, message);
      return { error: message };
    }
  } finally {
    // Best-effort release covering every path above that returns without
    // writeBack having run/succeeded (Stripe create threw, session.url came
    // back falsy, or writeBack itself errored). Guarded by lockTimestamp on
    // the DB side, so this is a harmless no-op on the success path —
    // writeBack already cleared session_lock_at there, and it's also a
    // no-op if this lease already expired and got re-claimed by someone
    // else. Never throws and never overwrites the real result above: the
    // call is wrapped in its own try/catch so even a rejected/thrown RPC
    // (e.g. a network-level failure, not just a resolved { error }) is fully
    // swallowed here — logged, never rethrown — so it can't break this
    // function's "never throws" contract that sendInvoiceAction and
    // regeneratePaymentLinkAction rely on.
    try {
      const { error: releaseError } = await supabase.rpc("release_invoice_checkout_session_lock", {
        p_invoice_id: invoiceId,
        p_claimed_at: lockTimestamp,
      });
      if (releaseError) {
        console.error(`release_invoice_checkout_session_lock failed for invoice ${invoiceId}:`, releaseError.message);
      }
    } catch (releaseErr) {
      const message = releaseErr instanceof Error ? releaseErr.message : String(releaseErr);
      console.error(`release_invoice_checkout_session_lock threw for invoice ${invoiceId}:`, message);
    }
  }
}
