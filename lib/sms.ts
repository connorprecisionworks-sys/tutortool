export function isSmsConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
}

const E164_REGEX = /^\+[1-9]\d{7,14}$/;

/**
 * Twilio's REST API requires E.164 (+countrycode...). payer_phone is a bare
 * `type="tel"` field with no format enforcement, so this normalizes the
 * common shapes a tutor would actually type. Assumes North American
 * numbering for bare 10/11-digit input — the only reasonable default with
 * no country picker in this MVP.
 */
export function normalizePhoneToE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("+")) {
    const candidate = `+${trimmed.slice(1).replace(/\D/g, "")}`;
    return E164_REGEX.test(candidate) ? candidate : null;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/** Keeps the last 4 digits for log correlation, masks the rest — phone
 * numbers are PII and shouldn't sit in plaintext server/cron logs. */
export function maskPhone(phone: string): string {
  if (phone.length <= 4) return "****";
  return `${phone.slice(0, -4).replace(/[0-9]/g, "*")}${phone.slice(-4)}`;
}

export interface SendSmsParams {
  to: string;
  body: string;
}

/**
 * Sends via Twilio's REST API if TWILIO_* env vars are set; otherwise logs
 * and no-ops. Same shape as lib/email.ts's sendEmail — a plain fetch
 * against the provider's HTTP API rather than pulling in their SDK, since
 * this is the only call site that needs it.
 * TODO(connor): no Twilio account was available during this build, so
 * this path is wired up but unexercised against a live account — see
 * notes/sms-reminders.md before turning it on for real (A2P 10DLC
 * registration is required for sustained volume on a local number).
 */
export async function sendSms(params: SendSmsParams): Promise<{ error?: string }> {
  if (!isSmsConfigured()) {
    const preview = params.body.length > 40 ? `${params.body.slice(0, 40)}…` : params.body;
    console.log(`[sms stub] would send to ${maskPhone(params.to)}: "${preview}"`);
    return {};
  }

  if (!E164_REGEX.test(params.to)) {
    return { error: "Destination phone number is not in E.164 format." };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER!;

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: params.to, From: fromNumber, Body: params.body }),
    });

    if (!res.ok) {
      // Twilio's error body often echoes the destination number back in its
      // `message` field — surface only the status/code, not the raw text,
      // so a failed send doesn't leak the phone number into server logs.
      let code: number | string | undefined;
      try {
        const parsed = JSON.parse(await res.text()) as { code?: number | string };
        code = parsed.code;
      } catch {
        // non-JSON body — fall back to status-only message below
      }
      return { error: `Twilio API error (status ${res.status}${code !== undefined ? `, code ${code}` : ""}).` };
    }
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send SMS." };
  }
}
