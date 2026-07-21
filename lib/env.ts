import { z } from "zod";

const RequiredEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().min(1),
  NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: z.string().min(1),
});

/**
 * Validates the env vars this app cannot run without, once at server boot
 * (called from instrumentation.ts's register()) instead of letting each
 * ad-hoc `process.env.X!` access site (lib/supabase/*, lib/posthog-server.ts,
 * instrumentation-client.ts) fail unpredictably at first use in production —
 * flagged in a production-readiness review as a real gap since zod was
 * already a dependency but never used for this. Stripe/Resend/Twilio keys
 * are deliberately excluded: those are feature-gated via
 * isStripeConfigured()/isEmailConfigured()/isSmsConfigured() and are meant
 * to work unset (e.g. a fresh clone before those integrations are wired up).
 */
export function validateRequiredEnv(): void {
  const result = RequiredEnvSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Missing required environment variable(s): ${missing}`);
  }
}

/**
 * NEXT_PUBLIC_APP_URL backs every Stripe redirect (Checkout success/cancel,
 * Connect onboarding refresh/return). Throwing here instead of silently
 * falling back to localhost means a missing env var in production fails
 * loudly at the point of use rather than quietly redirecting real
 * customers/tutors to an unreachable address.
 */
export function appUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_APP_URL is not set.");
  }
  return url;
}
