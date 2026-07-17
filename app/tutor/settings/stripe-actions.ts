"use server";

import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { getStripe, isStripeConfigured } from "@/lib/stripe/client";
import { appUrl } from "@/lib/env";
import { getPostHogClient } from "@/lib/posthog-server";

export interface StripeActionResult {
  error?: string;
  url?: string;
}

/**
 * Starts (or resumes) Stripe Connect Express onboarding for the signed-in
 * tutor. Creates the Express account on first call, then always issues a
 * fresh Account Link (these expire quickly, so no caching).
 */
export async function connectStripeAction(): Promise<StripeActionResult> {
  const tutor = await requireTutor();

  if (!isStripeConfigured()) {
    return { error: "Stripe isn't configured yet. Ask your developer to add API keys." };
  }

  try {
    const stripe = getStripe();
    const supabase = await createClient();

    let accountId = tutor.stripe_account_id;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: tutor.email || undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      accountId = account.id;

      const { error } = await supabase
        .from("tutors")
        .update({ stripe_account_id: accountId })
        .eq("id", tutor.id);
      if (error) return { error: error.message };
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl()}/tutor/settings?stripe=refresh`,
      return_url: `${appUrl()}/tutor/settings?stripe=return`,
      type: "account_onboarding",
    });

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: tutor.auth_user_id,
      event: "stripe_connect_started",
      properties: { is_new_account: !tutor.stripe_account_id },
    });
    await posthog.flush();

    return { url: link.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't reach Stripe. Try again.";
    return { error: message };
  }
}
