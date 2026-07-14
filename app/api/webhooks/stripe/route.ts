import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Stripe webhook — the only automated path that flips an invoice to Paid.
 * Uses the service-role admin client since there's no tutor session on an
 * incoming webhook request — RLS is deliberately bypassed here, guarded
 * instead by: (1) signature verification, (2) checking the event's
 * connected account against the invoice's actual owning tutor before ever
 * touching the row, and (3) a status-guarded UPDATE.
 *
 * Registration note: every Checkout Session this app creates is created
 * with `{ stripeAccount: tutor.stripe_account_id }` (a direct charge on the
 * tutor's connected account), so `checkout.session.completed` fires as a
 * *connected-account* event, not a platform-account event. This endpoint
 * must be registered in the Stripe dashboard as a Connect webhook
 * (listening to connected-account events), not just the default
 * platform-account endpoint, or these events will never arrive here.
 *
 * TODO(connor): unexercised against a live Stripe account — no test keys
 * were available during this build. Set STRIPE_WEBHOOK_SECRET and register
 * this endpoint (Connect webhook, checkout.session.completed) in the
 * Stripe dashboard, or `stripe listen --forward-to` with `--events` scoped
 * appropriately for local testing.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 501 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const invoiceId = session.metadata?.invoice_id;
  if (!invoiceId) {
    return NextResponse.json({ received: true, ignored: "no invoice_id in metadata" });
  }

  const admin = createAdminClient();

  // Cross-tenant guard: this webhook receives events for every connected
  // account under the platform. Verify the account that actually emitted
  // the event (event.account) matches the stripe_account_id of the tutor
  // who owns this invoice, before ever touching the row — otherwise any
  // connected-account tutor could pay a trivial session on their own
  // account with another tutor's invoice_id in metadata and falsely mark
  // that invoice paid.
  const { data: invoice } = await admin
    .from("invoices")
    .select("id, status, tutors(stripe_account_id)")
    .eq("id", invoiceId)
    .maybeSingle();

  const owningStripeAccountId = (invoice?.tutors as unknown as { stripe_account_id: string | null } | null)
    ?.stripe_account_id;

  if (!invoice || !owningStripeAccountId || owningStripeAccountId !== event.account) {
    console.error(
      `Stripe webhook: invoice ${invoiceId} account mismatch (event.account=${event.account}, expected=${owningStripeAccountId})`
    );
    return NextResponse.json({ received: true, ignored: "account mismatch" });
  }

  // Update first, record idempotency second. The UPDATE's own WHERE clause
  // (status in sent/overdue) makes it naturally idempotent — a redelivered
  // event just matches zero rows the second time. Recording the event id
  // BEFORE a successful mutation would risk permanently marking a failed
  // update as "already handled" with no retry path; doing it after means a
  // crash between the two just gets retried by Stripe's redelivery.
  const { error: updateError } = await admin
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString(), paid_method: "stripe" })
    .eq("id", invoiceId)
    .in("status", ["sent", "overdue"]);

  if (updateError) {
    console.error(`Stripe webhook: failed to mark invoice ${invoiceId} paid:`, updateError.message);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { error: insertError } = await admin
    .from("stripe_webhook_events")
    .insert({ id: event.id, event_type: event.type });

  if (insertError && insertError.code !== "23505") {
    // Already-paid is fine either way; only log a genuine insert failure.
    console.error(`Stripe webhook: failed to record event ${event.id}:`, insertError.message);
  }

  return NextResponse.json({ received: true });
}
