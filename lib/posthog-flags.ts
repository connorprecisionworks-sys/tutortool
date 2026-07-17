import { getPostHogClient } from "@/lib/posthog-server";

/**
 * Server-side feature flag helpers for Server Actions, Route Handlers, and
 * Server Components. Evaluate flags against the authenticated user's Supabase
 * `auth_user_id` so the same person gets a consistent rollout bucket on the
 * server as they do in the browser.
 *
 * Create the flag in PostHog first (Feature flags -> New), then reference its
 * key here. Example:
 *
 *   const on = await isFeatureEnabled("new-invoice-editor", tutor.auth_user_id);
 *   if (on) { ... }
 */

export async function isFeatureEnabled(
  key: string,
  distinctId: string,
  options?: { personProperties?: Record<string, string> }
): Promise<boolean> {
  const posthog = getPostHogClient();
  const result = await posthog.isFeatureEnabled(key, distinctId, {
    personProperties: options?.personProperties,
  });
  return result ?? false;
}

/**
 * Returns the flag's value. For a boolean flag this is `true`/`false`; for a
 * multivariate flag it's the variant key string (or `undefined` if the flag is
 * off / not found). Use this when a flag has more than two states.
 */
export async function getFeatureFlag(
  key: string,
  distinctId: string,
  options?: { personProperties?: Record<string, string> }
): Promise<boolean | string | undefined> {
  const posthog = getPostHogClient();
  return posthog.getFeatureFlag(key, distinctId, {
    personProperties: options?.personProperties,
  });
}
