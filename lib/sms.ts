import crypto from "node:crypto";

export function isSmsConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
}

const E164_REGEX = /^\+[1-9]\d{7,14}$/;

/**
 * The consent disclosure a tutor agrees to when ticking the SMS box on the
 * student form. Rendered as the checkbox label AND stored verbatim on the
 * client row, so the record of what was agreed to is the same sentence that
 * was actually on screen.
 *
 * MUST match current_sms_consent_text() in
 * supabase/migrations/20260812090000_sms1_consent_stop_shortlink.sql, which
 * is what the trigger stamps. Changing the wording means changing both and
 * shipping a migration — old rows keep their original text on purpose, since
 * consent given under different wording is a different fact.
 */
export const SMS_CONSENT_TEXT =
  "I confirm this parent gave permission to receive text messages about sessions and invoices.";

/**
 * Carrier-standard opt-out and opt-in keywords. Twilio already acts on these
 * at the carrier level for US numbers — delivery stops whether or not this
 * app ever finds out. That is exactly the problem: without the webhook that
 * uses these, Slate would keep showing an opted-in parent who is in fact
 * unreachable, and keep paying to send into a void.
 *
 * Matched on the whole trimmed body, not a substring: "please don't stop
 * sending these" is not an opt-out.
 */
const STOP_KEYWORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit", "revoke", "optout"]);
const START_KEYWORDS = new Set(["start", "yes", "unstop", "optin"]);

export type SmsKeyword = "stop" | "start" | null;

export function classifySmsKeyword(body: string): SmsKeyword {
  const normalized = body.trim().toLowerCase().replace(/[^a-z]/g, "");
  if (STOP_KEYWORDS.has(normalized)) return "stop";
  if (START_KEYWORDS.has(normalized)) return "start";
  return null;
}

/**
 * Verifies Twilio's X-Twilio-Signature over a form-encoded webhook.
 *
 * Twilio's scheme: concatenate the full request URL, then every POST
 * parameter appended as key+value in lexicographic key order, HMAC-SHA1 the
 * result with the account's auth token, base64 the digest. Implemented here
 * rather than pulling in the Twilio SDK for one function, matching how
 * sendSms already calls the REST API with plain fetch.
 *
 * Without this the opt-out endpoint is an unauthenticated write: anyone who
 * found the URL could opt arbitrary numbers out of their tutor's reminders.
 */
export function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string,
  authToken: string
): boolean {
  const payload = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);

  const expected = crypto.createHmac("sha1", authToken).update(Buffer.from(payload, "utf-8")).digest("base64");

  // Length check first: timingSafeEqual throws on a length mismatch rather
  // than returning false, and a wrong-length signature has already failed.
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

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


/**
 * GSM-7 is the 7-bit alphabet SMS uses by default: 160 characters per
 * segment. A SINGLE character outside it (an em dash, a curly apostrophe,
 * an ellipsis) forces the whole message to UCS-2, where a segment is 70
 * characters. A 140-character reminder silently goes from 1 segment to 3 —
 * triple the price, with nothing in the UI to explain why.
 *
 * Slate's own default templates shipped with em dashes in three of the
 * invoice reminders, which is exactly how this bites you in production.
 */
const GSM7_BASIC = new Set(
  "@\u00a3$\u00a5\u00e8\u00e9\u00f9\u00ec\u00f2\u00c7\u00d8\u00f8\u00c5\u00e5\u0394_\u03a6\u0393\u039b\u03a9\u03a0\u03a8\u03a3\u0398\u039e\u00c6\u00e6\u00df\u00c9" +
  " !\"#\u00a4%&'()*+,-./0123456789:;<=>?" +
  "\u00a1ABCDEFGHIJKLMNOPQRSTUVWXYZ\u00c4\u00d6\u00d1\u00dc\u00a7" +
  "\u00bfabcdefghijklmnopqrstuvwxyz\u00e4\u00f6\u00f1\u00fc\u00e0" +
  "\n\r"
);
/** Costs 2 units each: they're sent as an escape sequence. */
const GSM7_EXT = new Set("^{}\\[~]|\u20ac");

/**
 * Swaps the typographic characters a human (or a template) naturally writes
 * for their GSM-7 equivalents. Deliberately conservative: anything not in
 * this map is left alone, so a genuinely non-Latin name still sends
 * correctly as UCS-2 rather than being mangled into mojibake.
 */
const GSM7_SUBSTITUTIONS: Record<string, string> = {
  "\u2014": "-", "\u2013": "-", "\u2011": "-",
  "\u2018": "'", "\u2019": "'", "\u201b": "'", "\u2032": "'",
  "\u201c": '"', "\u201d": '"', "\u2033": '"',
  "\u2026": "...", "\u2022": "*", "\u00b7": ".",
  "\u00a0": " ", "\u202f": " ", "\u2009": " ", "\u200a": " ",
  "\u2192": "->", "\u00d7": "x",
  "\u2264": "<=", "\u2265": ">=", "\u2260": "!=",
};

/** Replaces smart punctuation with GSM-7-safe equivalents. */
export function toGsm7(text: string): string {
  let out = "";
  for (const ch of text) out += GSM7_SUBSTITUTIONS[ch] ?? ch;
  return out;
}

export interface SmsSegmentInfo {
  encoding: "GSM-7" | "UCS-2";
  units: number;
  segments: number;
  /** The characters that forced UCS-2, if any. Empty when GSM-7. */
  offenders: string[];
}

/**
 * Segment count and encoding for a message body — the number that actually
 * determines what a send costs.
 *
 * Concatenated messages lose room to the UDH header, so a multi-segment
 * GSM-7 message gets 153 characters per part (not 160) and UCS-2 gets 67
 * (not 70). Using 160/70 for multipart is the classic off-by-one that makes
 * a cost model read low.
 */
export function countSmsSegments(text: string): SmsSegmentInfo {
  const offenders = new Set<string>();
  let units = 0;
  for (const ch of text) {
    if (GSM7_BASIC.has(ch)) units += 1;
    else if (GSM7_EXT.has(ch)) units += 2;
    else offenders.add(ch);
  }
  if (offenders.size > 0) {
    // UCS-2 counts UTF-16 code units, so astral characters (emoji) cost 2.
    const u = text.length;
    return {
      encoding: "UCS-2",
      units: u,
      segments: u === 0 ? 0 : u <= 70 ? 1 : Math.ceil(u / 67),
      offenders: [...offenders],
    };
  }
  return {
    encoding: "GSM-7",
    units,
    segments: units === 0 ? 0 : units <= 160 ? 1 : Math.ceil(units / 153),
    offenders: [],
  };
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

  // Sanitize at the boundary, not at the call sites: every template, every
  // tutor-edited body, and every future caller goes through here, and none
  // of them should have to know what GSM-7 is.
  const body = toGsm7(params.body);
  const seg = countSmsSegments(body);
  if (seg.segments > 1) {
    console.warn(
      `[sms] ${seg.segments} segments (${seg.encoding}, ${seg.units} units) to ${maskPhone(params.to)}` +
        (seg.offenders.length ? ` — forced by ${JSON.stringify(seg.offenders)}` : "")
    );
  }

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: params.to, From: fromNumber, Body: body }),
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
