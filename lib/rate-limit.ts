import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Caller IP for rate-limit bucketing. On this app's Vercel deployment,
 * x-forwarded-for is set by Vercel's edge to the true connecting IP and
 * external values are overwritten before the function ever sees the
 * request — Vercel does not forward client-supplied X-Forwarded-For values
 * (see https://vercel.com/docs/headers/request-headers#x-forwarded-for,
 * "we currently overwrite the X-Forwarded-For header and do not forward
 * external IPs. This restriction is in place to prevent IP spoofing.").
 * x-vercel-forwarded-for is documented as identical, but survives even if a
 * customer's own proxy sits in front of Vercel (only case where
 * x-forwarded-for could be overwritten again downstream of Vercel), so it's
 * preferred here; x-real-ip is the same value under a third name. This
 * order stops mattering once/if this app is put behind Vercel's Enterprise
 * "Trusted Proxy" feature, which lets a caller set a custom
 * X-Forwarded-For — reassess then.
 *
 * Off-Vercel (local dev, self-hosted) none of these headers are trustworthy
 * — nothing here overwrites a client-supplied value. Returns null rather
 * than silently bucketing every caller together; production callers must
 * treat null as "can't verify caller, reject", dev callers fall back to a
 * fixed loopback key so local work isn't blocked.
 */
export async function getClientIp(): Promise<string | null> {
  const h = await headers();
  const ip = h.get("x-vercel-forwarded-for") ?? h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (ip) return ip;
  return process.env.NODE_ENV === "production" ? null : "127.0.0.1";
}

/**
 * Atomic check-and-increment against check_rate_limit() (see
 * supabase/migrations/20260721092000_sec3_rate_limiting.sql). Fails open
 * (allows the request) if the RPC itself errors — an outage in the rate
 * limiter must never take down the underlying feature, same "never let a
 * best-effort guard become a hard dependency" pattern used elsewhere in
 * this app (e.g. tryCreateStripePaymentLink).
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  bucketKey: string,
  maxCount: number,
  windowSeconds: number
): Promise<boolean> {
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_key: bucketKey,
    p_max_count: maxCount,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error(`check_rate_limit failed for ${bucketKey}:`, error.message);
    return true;
  }
  return Boolean(data);
}

/**
 * IP-keyed rate limit for anonymous/scriptable endpoints (signup, booking).
 * Fails closed on an unresolvable IP (see getClientIp) — unlike
 * checkRateLimit's own fail-open-on-RPC-error behavior, a caller this
 * function can't identify at all must not get an unlimited shared bucket.
 */
export async function checkIpRateLimit(
  supabase: SupabaseClient,
  keyPrefix: string,
  maxCount: number,
  windowSeconds: number
): Promise<boolean> {
  const ip = await getClientIp();
  if (!ip) return false;
  return checkRateLimit(supabase, `${keyPrefix}:${ip}`, maxCount, windowSeconds);
}

/**
 * Clears a bucket's count (see reset_rate_limit() in
 * supabase/migrations/20260724100000_sec4_login_account_rate_limit.sql —
 * NOT YET APPLIED). Used to give a legitimate caller their full attempt
 * budget back after they succeed (e.g. a login that fumbled a password
 * twice before getting in) rather than leaving them a few failed attempts
 * away from being locked out on their next visit. Best-effort, same
 * fail-open shape as checkRateLimit — never let a reset failure undo or
 * delay the success it's cleaning up after.
 */
export async function resetRateLimit(supabase: SupabaseClient, bucketKey: string): Promise<void> {
  const { error } = await supabase.rpc("reset_rate_limit", { p_key: bucketKey });
  if (error) {
    console.error(`reset_rate_limit failed for ${bucketKey}:`, error.message);
  }
}
