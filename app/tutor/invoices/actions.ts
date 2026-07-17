"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { dollarsToCents } from "@/lib/money";
import { getStripe, getStripeAccountStatus, isStripeConfigured } from "@/lib/stripe/client";
import { appUrl } from "@/lib/env";
import { getPostHogClient } from "@/lib/posthog-server";

/**
 * Best-effort: create a Stripe Checkout Session (direct charge on the
 * tutor's connected Express account) for a sent/overdue invoice and persist
 * the link. Never throws — a Stripe hiccup shouldn't undo a successful send;
 * the tutor still has the manual mark-as-paid fallback. Callable both right
 * after send and on-demand to refresh an expired link (Checkout Session
 * URLs expire ~24h after creation, well inside a net-7/14/30 invoice's
 * life, so this needs to be re-callable, not just a one-shot at send time).
 */
async function tryCreateStripePaymentLink(invoiceId: string): Promise<{ error?: string }> {
  if (!isStripeConfigured()) return {};

  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, tutors(stripe_account_id), clients(payer_email, student_name)")
    .eq("id", invoiceId)
    .maybeSingle();

  const tutorRow = invoice?.tutors as unknown as { stripe_account_id: string | null } | null;
  const clientRow = invoice?.clients as unknown as { payer_email: string | null; student_name: string } | null;
  if (!invoice || !tutorRow?.stripe_account_id) return {};

  const status = await getStripeAccountStatus(tutorRow.stripe_account_id);
  if (!status?.chargesEnabled) return {};

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
      { stripeAccount: tutorRow.stripe_account_id }
    );

    if (session.url) {
      const { error } = await supabase.rpc("set_invoice_stripe_link", {
        p_invoice_id: invoiceId,
        p_stripe_checkout_session_id: session.id,
        p_stripe_payment_url: session.url,
      });
      if (error) {
        console.error(`set_invoice_stripe_link failed for invoice ${invoiceId}:`, error.message);
        return { error: error.message };
      }
    }
    return {};
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error creating the payment link.";
    console.error(`tryCreateStripePaymentLink failed for invoice ${invoiceId}:`, message);
    return { error: message };
  }
}

export interface InvoiceFormResult {
  error?: string;
  invoiceId?: string;
}

export async function createDraftInvoiceAction(
  _prev: InvoiceFormResult,
  formData: FormData
): Promise<InvoiceFormResult> {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const clientId = String(formData.get("client_id") ?? "");
  const periodStart = String(formData.get("period_start") ?? "");
  const periodEnd = String(formData.get("period_end") ?? "");

  if (!clientId) return { error: "Pick a student." };
  if (!periodStart || !periodEnd) return { error: "Pick a date range." };
  if (periodStart > periodEnd) return { error: "Start date must be before end date." };

  const { data, error } = await supabase.rpc("create_draft_invoice", {
    p_client_id: clientId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
  });

  if (error) return { error: error.message };

  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: tutor.auth_user_id,
    event: "invoice_created",
    properties: { period_start: periodStart, period_end: periodEnd },
  });
  await posthog.flush();

  revalidatePath("/tutor/invoices");
  return { invoiceId: data as string };
}

export async function addManualLineAction(
  _prev: InvoiceFormResult,
  formData: FormData
): Promise<InvoiceFormResult> {
  await requireTutor();
  const supabase = await createClient();

  const invoiceId = String(formData.get("invoice_id") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const amountDollars = Number(formData.get("amount") ?? "0");

  if (!description) return { error: "Description is required." };
  if (!amountDollars || Number.isNaN(amountDollars) || amountDollars <= 0) {
    return { error: "Enter an amount greater than zero." };
  }

  const { error } = await supabase.rpc("add_manual_line_item", {
    p_invoice_id: invoiceId,
    p_description: description,
    p_amount_cents: dollarsToCents(amountDollars),
  });

  if (error) return { error: error.message };

  revalidatePath(`/tutor/invoices/${invoiceId}`);
  return {};
}

export async function removeLineItemAction(
  lineItemId: string,
  invoiceId: string
): Promise<{ error?: string }> {
  await requireTutor();
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_line_item", { p_line_item_id: lineItemId });
  revalidatePath(`/tutor/invoices/${invoiceId}`);
  if (error) return { error: error.message };
  return {};
}

export async function sendInvoiceAction(invoiceId: string): Promise<{ error?: string }> {
  const tutor = await requireTutor();
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_invoice", { p_invoice_id: invoiceId });

  if (!error) {
    await tryCreateStripePaymentLink(invoiceId);

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: tutor.auth_user_id,
      event: "invoice_sent",
      properties: { invoice_id: invoiceId },
    });
    await posthog.flush();
  }

  revalidatePath(`/tutor/invoices/${invoiceId}`);
  revalidatePath("/tutor/invoices");
  revalidatePath("/tutor/sessions");
  if (error) return { error: error.message };
  return {};
}

/** Manually (re)generate the Stripe payment link — covers an expired Checkout Session on a still-unpaid sent/overdue invoice. */
export async function regeneratePaymentLinkAction(invoiceId: string): Promise<{ error?: string }> {
  await requireTutor();
  if (!isStripeConfigured()) {
    return { error: "Stripe isn't configured yet. Ask your developer to add API keys." };
  }
  const result = await tryCreateStripePaymentLink(invoiceId);
  revalidatePath(`/tutor/invoices/${invoiceId}`);
  return result;
}

export async function markInvoicePaidAction(invoiceId: string, method: string): Promise<{ error?: string }> {
  const tutor = await requireTutor();
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_invoice_paid", { p_invoice_id: invoiceId, p_method: method });

  if (!error) {
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: tutor.auth_user_id,
      event: "invoice_paid_manually",
      properties: { invoice_id: invoiceId, payment_method: method },
    });
    await posthog.flush();
  }

  revalidatePath(`/tutor/invoices/${invoiceId}`);
  revalidatePath("/tutor/invoices");
  if (error) return { error: error.message };
  return {};
}

export async function deleteDraftInvoiceAction(invoiceId: string): Promise<{ error?: string }> {
  await requireTutor();
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_draft_invoice", { p_invoice_id: invoiceId });

  revalidatePath("/tutor/invoices");
  revalidatePath("/tutor/sessions");
  if (error) return { error: error.message };
  return {};
}

export async function voidInvoiceAction(invoiceId: string): Promise<{ error?: string }> {
  await requireTutor();
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_invoice", { p_invoice_id: invoiceId });
  revalidatePath(`/tutor/invoices/${invoiceId}`);
  revalidatePath("/tutor/invoices");
  revalidatePath("/tutor/sessions");
  if (error) return { error: error.message };
  return {};
}
