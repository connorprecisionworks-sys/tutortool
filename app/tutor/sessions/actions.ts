"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import {
  resolveBillTravel,
  resolveEffectiveRateCents,
  resolveTravelRateCents,
  type RateType,
} from "@/lib/billing";
import { getPostHogClient } from "@/lib/posthog-server";
import { getStripe, isStripeConfigured } from "@/lib/stripe/client";

export interface SessionFormResult {
  error?: string;
}

export async function createSessionAction(
  _prev: SessionFormResult,
  formData: FormData
): Promise<SessionFormResult> {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const clientId = String(formData.get("client_id") ?? "");
  const serviceId = String(formData.get("service_id") ?? "").trim();
  const occurredOn = String(formData.get("occurred_on") ?? "");
  const startTime = String(formData.get("start_time") ?? "").trim();
  const durationMinutes = Number(formData.get("duration_minutes") ?? "0");
  const travelMinutes = Number(formData.get("travel_minutes") ?? "0");
  const location = String(formData.get("location") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!clientId) return { error: "Pick a student." };
  if (!occurredOn) return { error: "Date is required." };
  if (!durationMinutes || durationMinutes <= 0) return { error: "Duration must be more than 0 minutes." };
  if (travelMinutes < 0) return { error: "Travel minutes can't be negative." };

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .eq("tutor_id", tutor.id)
    .maybeSingle();

  if (clientError || !client) return { error: "Student not found." };

  // A service's price is snapshotted onto the session at log time, same
  // rationale as effective_rate_cents — re-fetched and re-validated here
  // (ownership + still active) rather than trusting a client-supplied price.
  let servicePriceCents: number | null = null;
  if (serviceId) {
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("price_cents")
      .eq("id", serviceId)
      .eq("tutor_id", tutor.id)
      .eq("is_active", true)
      .maybeSingle();
    if (serviceError || !service) return { error: "Service not found or no longer offered." };
    servicePriceCents = service.price_cents;
  }

  const effectiveRateCents = resolveEffectiveRateCents(
    client.rate_type as RateType,
    client.custom_rate_cents,
    tutor.standard_rate_cents
  );
  const billTravel = resolveBillTravel(client.bill_travel, tutor.bill_travel_default);
  const travelRateCents = billTravel
    ? resolveTravelRateCents(client.travel_rate_cents, tutor.travel_rate_cents, effectiveRateCents)
    : null;

  const { error } = await supabase.from("sessions").insert({
    tutor_id: tutor.id,
    client_id: clientId,
    service_id: serviceId || null,
    service_price_cents: servicePriceCents,
    occurred_on: occurredOn,
    start_time: startTime || null,
    duration_minutes: Math.round(durationMinutes),
    travel_minutes: Math.round(travelMinutes),
    location: location || null,
    bill_travel: billTravel,
    effective_rate_cents: effectiveRateCents,
    travel_rate_cents: travelRateCents,
    notes: notes || null,
  });

  if (error) return { error: error.message };

  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: tutor.auth_user_id,
    event: "session_logged",
    properties: {
      duration_minutes: Math.round(durationMinutes),
      travel_minutes: Math.round(travelMinutes),
      bill_travel: billTravel,
      has_location: Boolean(location),
      has_notes: Boolean(notes),
    },
  });
  await posthog.flush();

  revalidatePath("/tutor/sessions");
  revalidatePath("/tutor");
  return {};
}

export async function updateSessionAction(
  _prev: SessionFormResult,
  formData: FormData
): Promise<SessionFormResult> {
  const sessionId = String(formData.get("id") ?? "");
  if (!sessionId) return { error: "Missing session id." };

  await requireTutor();
  const supabase = await createClient();

  const occurredOn = String(formData.get("occurred_on") ?? "");
  const startTime = String(formData.get("start_time") ?? "").trim();
  const durationMinutes = Number(formData.get("duration_minutes") ?? "0");
  const travelMinutes = Number(formData.get("travel_minutes") ?? "0");
  const location = String(formData.get("location") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!occurredOn) return { error: "Date is required." };
  if (!durationMinutes || durationMinutes <= 0) return { error: "Duration must be more than 0 minutes." };
  if (travelMinutes < 0) return { error: "Travel minutes can't be negative." };

  // update_session (SECURITY DEFINER) re-resolves the rate snapshot from
  // the client's *current* rate rule, blocks edits on a billed session, and
  // — if this session is claimed onto a draft invoice — resyncs that
  // invoice's line item + total in the same transaction.
  const { error } = await supabase.rpc("update_session", {
    p_session_id: sessionId,
    p_occurred_on: occurredOn,
    // The generated RPC arg types don't reflect that these Postgres params
    // accept null (the type generator only sees the SQL types, not that
    // the function body is fine with a null time/text) — Postgres itself
    // accepts null here without issue.
    p_start_time: (startTime || null) as unknown as string,
    p_duration_minutes: Math.round(durationMinutes),
    p_travel_minutes: Math.round(travelMinutes),
    p_location: (location || null) as unknown as string,
    p_notes: (notes || null) as unknown as string,
  });

  if (error) return { error: error.message };

  revalidatePath("/tutor/sessions");
  revalidatePath(`/tutor/sessions/${sessionId}`);
  revalidatePath("/tutor/invoices");
  revalidatePath("/tutor");
  return {};
}

export async function deleteSessionAction(sessionId: string): Promise<SessionFormResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_session", { p_session_id: sessionId });

  if (error) return { error: error.message };

  revalidatePath("/tutor/sessions");
  revalidatePath("/tutor/invoices");
  revalidatePath("/tutor");
  return {};
}

interface CancelSessionRpcResult {
  handling: "rollover" | "refund" | "charge";
  was_paid: boolean;
  invoice_id: string | null;
  amount_cents: number;
  client_id: string;
}

/**
 * Best-effort Stripe refund for a cancelled, already-paid session — never
 * throws, same pattern as tryCreateStripePaymentLink in
 * app/tutor/invoices/actions.ts. A partial refund (this session's amount,
 * not the whole invoice, since other sessions on the same invoice may be
 * unaffected) against the PaymentIntent behind the original Checkout
 * Session. TODO(connor): unexercised against a live Stripe account, same
 * caveat as every other Stripe path in this build (no test keys provided).
 */
async function tryRefundStripeSession(invoiceId: string, amountCents: number): Promise<{ error?: string }> {
  if (!isStripeConfigured()) return {};

  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("stripe_invoice_id, tutors(stripe_account_id)")
    .eq("id", invoiceId)
    .maybeSingle();

  const tutorRow = invoice?.tutors as unknown as { stripe_account_id: string | null } | null;
  if (!invoice?.stripe_invoice_id || !tutorRow?.stripe_account_id) {
    return { error: "No Stripe payment on file for this invoice — refund manually." };
  }

  try {
    const stripe = getStripe();
    // invoices.stripe_invoice_id actually stores the Checkout Session id
    // (see set_invoice_stripe_link) — the PaymentIntent (and its charge)
    // has to be looked up from there since the webhook never stored it
    // directly. Nested expand pulls both in one call.
    const checkoutSession = await stripe.checkout.sessions.retrieve(
      invoice.stripe_invoice_id,
      { expand: ["payment_intent.latest_charge"] },
      { stripeAccount: tutorRow.stripe_account_id }
    );
    const paymentIntent =
      typeof checkoutSession.payment_intent === "string" ? null : checkoutSession.payment_intent;
    if (!paymentIntent) return { error: "Could not find the original payment to refund." };
    const charge = typeof paymentIntent.latest_charge === "string" ? null : paymentIntent.latest_charge;

    // amountCents is this ONE session's value, but the invoice it was
    // billed on may cover other sessions too (and may have had a credit
    // applied, so less was captured than the raw subtotal) — cap the
    // request at what's actually still refundable on this specific
    // charge, rather than trusting amountCents blindly and having Stripe
    // reject an over-refund after the session is already marked cancelled.
    const capturedCents = charge?.amount ?? paymentIntent.amount_received ?? paymentIntent.amount;
    const alreadyRefundedCents = charge?.amount_refunded ?? 0;
    const remainingRefundableCents = capturedCents - alreadyRefundedCents;
    if (remainingRefundableCents <= 0) {
      return { error: "Nothing left to refund on this payment — it may already be fully refunded." };
    }
    const refundCents = Math.min(amountCents, remainingRefundableCents);

    await stripe.refunds.create(
      { payment_intent: paymentIntent.id, amount: refundCents },
      { stripeAccount: tutorRow.stripe_account_id }
    );
    return {};
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error issuing the refund.";
    console.error(`tryRefundStripeSession failed for invoice ${invoiceId}:`, message);
    return { error: message };
  }
}

export interface CancelSessionResult {
  error?: string;
}

export async function cancelSessionAction(
  sessionId: string,
  overrideHandling: string | null
): Promise<CancelSessionResult> {
  await requireTutor();
  const supabase = await createClient();

  // cancel_session (SECURITY DEFINER) resolves the effective handling
  // (override, or the tutor's default/window rule), stamps the session
  // cancelled, and — for a rollover on an already-paid session — issues
  // the credit. A Stripe refund can't happen in SQL, so for 'refund' the
  // RPC just reports what needs refunding and this action makes the call.
  const { data, error } = await supabase.rpc("cancel_session", {
    p_session_id: sessionId,
    p_override_handling: (overrideHandling || null) as unknown as string,
  });

  if (error) return { error: error.message };

  const result = data as unknown as CancelSessionRpcResult;

  revalidatePath("/tutor/sessions");
  revalidatePath(`/tutor/sessions/${sessionId}`);
  revalidatePath("/tutor/invoices");
  revalidatePath("/tutor");

  if (result.handling === "refund" && result.was_paid && result.invoice_id) {
    const refundResult = await tryRefundStripeSession(result.invoice_id, result.amount_cents);
    if (refundResult.error) {
      // The cancellation itself already succeeded — surface the refund
      // failure as its own message rather than implying the cancel failed.
      return { error: `Session cancelled, but the refund needs a manual follow-up: ${refundResult.error}` };
    }
  }

  return {};
}
