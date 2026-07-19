"use server";

import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { parentFacingIdentity } from "@/lib/email-identity";
import { renderEmailShell } from "@/lib/email-shell";
import { escapeHtml } from "@/lib/html-escape";

export interface MessageFormResult {
  error?: string;
  sent?: boolean;
}

/**
 * A tutor composing a one-off, free-form email to a student's payer — not a
 * templated automatic send (see D9's Email Center / lib/email-templates.ts),
 * so there's no notification-settings toggle to check; the tutor is
 * explicitly choosing to send this one message right now.
 */
export async function sendAdHocMessageAction(
  _prev: MessageFormResult,
  formData: FormData
): Promise<MessageFormResult> {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const clientId = String(formData.get("client_id") ?? "");
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!clientId) return { error: "Student not found." };
  if (!subject) return { error: "Subject is required." };
  if (!body) return { error: "Message body is required." };

  const { data: client } = await supabase
    .from("clients")
    .select("payer_email, student_name")
    .eq("id", clientId)
    .eq("tutor_id", tutor.id)
    .maybeSingle();

  if (!client) return { error: "Student not found." };
  if (!client.payer_email) return { error: "No payer email on file for this student." };

  if (!isEmailConfigured()) {
    console.log(`[email stub] would send ad-hoc message to ${client.payer_email}: "${subject}"`);
    return { sent: true };
  }

  const html = renderEmailShell({
    bodyHtml: `<p style="margin:0;white-space:pre-wrap;">${escapeHtml(body).replace(/\n/g, "<br/>")}</p>`,
  });

  const result = await sendEmail({
    to: client.payer_email,
    subject,
    html,
    ...parentFacingIdentity(tutor),
  });

  if (result.error) return { error: result.error };

  return { sent: true };
}
