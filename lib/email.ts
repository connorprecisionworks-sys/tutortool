export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends via Resend if RESEND_API_KEY is set; otherwise logs and no-ops.
 * TODO(connor): no Resend key was provided during this build, so every
 * reminder/invoice email in this app currently just logs server-side
 * instead of delivering. Add RESEND_API_KEY (and set EMAIL_FROM) in
 * .env.local to go live — no other code changes needed.
 */
export async function sendEmail(params: SendEmailParams): Promise<{ error?: string }> {
  if (!isEmailConfigured()) {
    console.log(`[email stub] would send to ${params.to}: "${params.subject}"`);
    return {};
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "TutorTool <onboarding@resend.dev>",
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { error: `Resend API error (${res.status}): ${text}` };
    }
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send email." };
  }
}
