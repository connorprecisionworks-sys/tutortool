// Runs once at server boot (before any request is handled) — fails loudly
// and immediately on a missing required env var instead of that surfacing
// later as a confusing runtime crash on whichever request happens to hit
// that code path first.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateRequiredEnv } = await import("@/lib/env");
    validateRequiredEnv();
  }
}

// Server-side error hook: Server Component render errors, Route Handler
// throws, and Server Action throws that aren't explicitly caught only ever
// showed up in raw Vercel function logs before this — nothing paged/alerted
// anyone (flagged in a production-readiness review). Reuses the PostHog
// project already wired up client-side (instrumentation-client.ts) rather
// than adding a second APM vendor. Untyped against Next's own instrumentation
// types (not exported from the top-level "next" package) — Next detects this
// hook at runtime by name/signature, not by a shared type import.
export async function onRequestError(error: unknown): Promise<void> {
  const { getPostHogClient } = await import("@/lib/posthog-server");
  const posthog = getPostHogClient();
  posthog.captureException(error);
  await posthog.flush();
}
