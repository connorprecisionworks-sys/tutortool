import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Best-effort caller IP from the standard proxy headers Vercel sets. Falls back to a fixed key so a missing header degrades to "one shared bucket" rather than silently skipping the check. */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
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
