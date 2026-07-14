"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { sendEmail } from "@/lib/email";
import { formatCents } from "@/lib/money";
import { interpolateTemplate, type ReminderTemplates } from "@/lib/reminders";

export async function sendReminderNowAction(
  invoiceId: string,
  templateKey: string
): Promise<{ error?: string }> {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, clients(payer_email, student_name)")
    .eq("id", invoiceId)
    .eq("tutor_id", tutor.id)
    .maybeSingle();

  if (!invoice) return { error: "Invoice not found." };

  const client = invoice.clients as unknown as { payer_email: string | null; student_name: string } | null;
  if (!client?.payer_email) return { error: "No payer email on file for this student." };

  const template = (tutor.reminder_templates as unknown as ReminderTemplates)?.[templateKey];
  if (!template) return { error: "Template not found." };

  // Log first (a manual-suffixed key so it never collides with the
  // automated cadence's unique offset_N keys, letting the tutor resend
  // deliberately as many times as they like). log_reminder's own
  // eligibility check (status sent/overdue, owned by this tutor) runs here
  // — if it fails, we bail before ever sending the email, so a status race
  // (e.g. a webhook just marked this paid) can't result in an email going
  // out with nothing recorded.
  const manualKey = `${templateKey}_manual_${Date.now()}`;
  const { error: logError } = await supabase.rpc("log_reminder", {
    p_invoice_id: invoiceId,
    p_template_key: manualKey,
    p_channel: "email",
  });
  if (logError) return { error: logError.message };

  const filled = interpolateTemplate(template, {
    student: client.student_name,
    tutor: tutor.name,
    amount: formatCents(invoice.total_cents),
    due_date: invoice.due_date ?? "",
    link: invoice.stripe_payment_url ?? "",
  });

  const sendResult = await sendEmail({
    to: client.payer_email,
    subject: filled.subject,
    html: `<p>${filled.body.replace(/\n/g, "<br/>")}</p>`,
  });

  revalidatePath(`/tutor/invoices/${invoiceId}`);

  if (sendResult.error) {
    return { error: `Logged, but the email failed to send: ${sendResult.error}` };
  }
  return {};
}
