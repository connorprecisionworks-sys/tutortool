import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { classifySmsKeyword, maskPhone, normalizePhoneToE164, verifyTwilioSignature } from "@/lib/sms";

export const runtime = "nodejs";

/**
 * Twilio inbound-message webhook. Its only job is keeping this database
 * honest about who can actually be reached.
 *
 * Twilio answers STOP at the carrier by itself — delivery to that number
 * halts whether or not Slate ever hears about it. The gap that closes here
 * is on our side: without it, a tutor keeps seeing an opted-in parent who is
 * in fact unreachable, keeps believing reminders went out, and Slate keeps
 * paying for sends that are dropped. Worse, at audit time the record would
 * show consent for someone who explicitly revoked it.
 *
 * Uses the service-role admin client because an inbound webhook carries no
 * session. That is guarded by signature verification below — this endpoint
 * writes opt-out state keyed only on a phone number, so an unauthenticated
 * caller could otherwise silence any number they liked.
 *
 * Register in the Twilio Console under the number's Messaging → "A message
 * comes in" webhook, pointing at {APP_URL}/api/webhooks/twilio (HTTP POST).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    return NextResponse.json({ error: "SMS not configured." }, { status: 501 });
  }

  const signature = request.headers.get("x-twilio-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") params[key] = value;
  }

  // Twilio signs the URL it was configured with. Behind Vercel's proxy
  // request.url can present as http, which would break the HMAC, so the
  // canonical public URL is preferred when it's set and only falls back to
  // the request's own URL for local development.
  const configuredBase = process.env.NEXT_PUBLIC_APP_URL;
  const signedUrl = configuredBase
    ? `${configuredBase.replace(/\/$/, "")}/api/webhooks/twilio`
    : request.url;

  if (!verifyTwilioSignature(signedUrl, params, signature, authToken)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 403 });
  }

  const keyword = classifySmsKeyword(params.Body ?? "");
  if (!keyword) {
    // Not an opt-out/opt-in. Slate has no inbound-message inbox, so there is
    // nothing to do with it — 204 rather than an error, and deliberately no
    // auto-reply, which would cost a segment and risk an unsolicited-message
    // complaint against a number that just texted us once.
    return new NextResponse(null, { status: 204 });
  }

  const from = normalizePhoneToE164(params.From ?? "");
  if (!from) {
    console.error("Twilio webhook: unparseable From number.");
    return new NextResponse(null, { status: 204 });
  }

  const supabase = createAdminClient();
  const rpc = keyword === "stop" ? "record_sms_opt_out" : "record_sms_opt_in";
  const { data, error } = await supabase.rpc(rpc, { p_phone: from });

  if (error) {
    // 500 so Twilio retries — a dropped STOP is a compliance failure, not a
    // cosmetic one, and is worth the duplicate delivery that a retry risks
    // (both RPCs are idempotent).
    console.error(`${rpc} failed for ${maskPhone(from)}:`, error.message);
    return NextResponse.json({ error: "Failed to record." }, { status: 500 });
  }

  console.log(`Twilio ${keyword} from ${maskPhone(from)}: ${data ?? 0} client row(s) updated.`);

  // Empty TwiML: acknowledges the message without sending a reply. Twilio's
  // own STOP confirmation to the handset already went out at the carrier.
  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
