export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  /**
   * Display name to show in the recipient's inbox instead of the bare
   * EMAIL_FROM display name — e.g. "{Tutor Name} via Slate" for a
   * parent-facing send. The address itself always stays EMAIL_FROM's
   * verified domain (SPF/DKIM/DMARC would fail on a tutor's raw address).
   */
  fromName?: string;
  /** Reply-To — e.g. the tutor's own email, so a parent's reply reaches them, not Slate. */
  replyTo?: string;
}

/** Pulls the bare address out of an "EMAIL_FROM" env value that may already be "Name <addr>". */
function fromAddress(): string {
  const raw = process.env.EMAIL_FROM ?? "Slate <onboarding@resend.dev>";
  const match = raw.match(/<([^>]+)>/);
  return match ? match[1] : raw;
}

/**
 * A tutor's display name is free text (no character restriction beyond a
 * trim in Settings) but ends up in a mailbox display-name position of a
 * real RFC 5322 header — an un-quoted "," or "<...>" there is either
 * mis-parsed as a second address or rejected outright by Resend. Always
 * wrapping it in a quoted-string (escaping the two characters that end a
 * quoted-string early) makes any tutor-chosen name safe there. CR/LF are
 * stripped too, since this string is spliced directly into a header value.
 */
function quoteMailboxName(name: string): string {
  const sanitized = name.replace(/[\r\n]/g, "").trim();
  return `"${sanitized.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** Sends via Resend if RESEND_API_KEY is set; otherwise logs and no-ops. */
export async function sendEmail(params: SendEmailParams): Promise<{ error?: string }> {
  if (!isEmailConfigured()) {
    console.log(`[email stub] would send to ${params.to}: "${params.subject}"`);
    return {};
  }

  const from = params.fromName
    ? `${quoteMailboxName(params.fromName)} <${fromAddress()}>`
    : (process.env.EMAIL_FROM ?? "Slate <onboarding@resend.dev>");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
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
