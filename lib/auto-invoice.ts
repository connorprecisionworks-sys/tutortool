import type { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, getStripeAccountStatus, isStripeConfigured } from "@/lib/stripe/client";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/date";
import { resolveSystemTemplate, renderTemplateEmailHtml } from "@/lib/email-templates";
import { parentFacingIdentity } from "@/lib/email-identity";
import { isNotificationEnabled, type NotificationSettings } from "@/lib/notification-settings";
import type { ReminderTemplates } from "@/lib/reminders";
import { appUrl } from "@/lib/env";

type Admin = ReturnType<typeof createAdminClient>;

/** Weekly-cadence auto-invoicing fires this many days after the tutor enables it, and every cycle after. */
export const AUTO_INVOICE_WEEKLY_CADENCE_DAYS = 7;

const LOGO_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/brand/logo/slate-logo-on-light.png`
  : null;

export interface AutoInvoiceOutcome {
  invoiceId: string | null;
  claimed: boolean;
  error?: string;
}

/**
 * Best-effort Stripe Checkout Session creation for a just-auto-sent invoice.
 * Mirrors tryCreateStripePaymentLink in app/tutor/invoices/actions.ts, but
 * can't reuse it directly: that helper reads via the RLS-scoped client and
 * persists through set_invoice_stripe_link, a current_tutor_id()-gated
 * SECURITY DEFINER function that would reject a service-role caller (no
 * auth.uid()). Writing the link straight to the invoices row is safe here
 * since the admin client bypasses RLS entirely.
 */
async function tryCreateStripePaymentLinkAsAdmin(admin: Admin, invoiceId: string): Promise<void> {
  if (!isStripeConfigured()) return;

  const { data: invoice } = await admin
    .from("invoices")
    .select("*, tutors(stripe_account_id), clients(payer_email, student_name)")
    .eq("id", invoiceId)
    .maybeSingle();

  const tutorRow = invoice?.tutors as unknown as { stripe_account_id: string | null } | null;
  const clientRow = invoice?.clients as unknown as { payer_email: string | null; student_name: string } | null;
  if (!invoice || !tutorRow?.stripe_account_id) return;

  const status = await getStripeAccountStatus(tutorRow.stripe_account_id);
  if (!status?.chargesEnabled) return;

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
      await admin
        .from("invoices")
        .update({ stripe_invoice_id: session.id, stripe_payment_url: session.url })
        .eq("id", invoiceId);
    }
  } catch (err) {
    console.error(
      `tryCreateStripePaymentLinkAsAdmin failed for invoice ${invoiceId}:`,
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * Runs run_client_auto_invoice() for a client, then (best-effort) attaches a
 * Stripe payment link and emails the parent. Unlike the manual invoice flow
 * (tutor copies/shares the link themselves), there's no human in the loop
 * here, so the notification email is load-bearing, not a nice-to-have —
 * gracefully no-ops (logs intent) without a Resend key, same as every other
 * automated send in the app. Never throws: a Stripe/email hiccup must not
 * undo a successfully generated+sent invoice.
 */
async function runAndNotify(admin: Admin, clientId: string): Promise<{ invoiceId: string | null; error?: string }> {
  const { data: invoiceId, error } = await admin.rpc("run_client_auto_invoice", { p_client_id: clientId });
  if (error) return { invoiceId: null, error: error.message };
  if (!invoiceId) return { invoiceId: null };

  await tryCreateStripePaymentLinkAsAdmin(admin, invoiceId);

  const { data: invoice } = await admin
    .from("invoices")
    .select(
      "total_cents, due_date, stripe_payment_url, tutors(name, email, reminder_templates, notification_settings), clients(payer_email, student_name)"
    )
    .eq("id", invoiceId)
    .maybeSingle();

  const tutor = invoice?.tutors as unknown as {
    name: string;
    email: string;
    reminder_templates: ReminderTemplates;
    notification_settings: NotificationSettings | null;
  } | null;
  const client = invoice?.clients as unknown as { payer_email: string | null; student_name: string } | null;

  if (!tutor || !invoice?.due_date) return { invoiceId };

  if (!client?.payer_email) {
    console.log(`[auto-invoice] invoice ${invoiceId} sent — no payer email on file, nothing to email.`);
    return { invoiceId };
  }

  if (!isNotificationEnabled(tutor.notification_settings, "parent_auto_invoice")) {
    return { invoiceId };
  }

  const template = resolveSystemTemplate(tutor.reminder_templates, "auto_invoice_sent");
  const rendered = renderTemplateEmailHtml(
    template,
    {
      student: client.student_name,
      tutor: tutor.name,
      amount: formatCents(invoice.total_cents),
      due_date: formatDate(invoice.due_date),
      link: invoice.stripe_payment_url ?? "",
    },
    { ctaLabel: "Pay invoice", logoUrl: LOGO_URL }
  );

  if (!isEmailConfigured()) {
    console.log(`[auto-invoice] would email ${client.payer_email} for invoice ${invoiceId} (Resend not configured)`);
    return { invoiceId };
  }

  const sendResult = await sendEmail({
    to: client.payer_email,
    subject: rendered.subject,
    html: rendered.html,
    ...parentFacingIdentity(tutor),
  });
  if (sendResult.error) {
    console.error(`Auto-invoice email failed for invoice ${invoiceId}:`, sendResult.error);
  }

  return { invoiceId };
}

/**
 * Claim-then-run: inserts a row into auto_invoice_runs first (unique on
 * (client_id, trigger_key)) so a concurrent or retried call for the exact
 * same trigger event — a re-run cron, a doubled request — can never
 * generate two invoices. A unique-violation on the claim means another
 * caller already handled this exact event; treated as a clean skip, not an
 * error.
 */
export async function claimAndRunAutoInvoice(
  admin: Admin,
  clientId: string,
  triggerKey: string
): Promise<AutoInvoiceOutcome> {
  const { error: claimError } = await admin
    .from("auto_invoice_runs")
    .insert({ client_id: clientId, trigger_key: triggerKey });

  if (claimError) {
    if (claimError.code !== "23505") {
      console.error(`Auto-invoice claim failed for ${clientId}/${triggerKey}:`, claimError.message);
    }
    return { invoiceId: null, claimed: false };
  }

  const { invoiceId, error } = await runAndNotify(admin, clientId);

  if (invoiceId) {
    await admin
      .from("auto_invoice_runs")
      .update({ invoice_id: invoiceId })
      .eq("client_id", clientId)
      .eq("trigger_key", triggerKey);
  }
  if (error) {
    console.error(`run_client_auto_invoice failed for ${clientId}/${triggerKey}:`, error);
  }

  return { invoiceId, claimed: true, error };
}
