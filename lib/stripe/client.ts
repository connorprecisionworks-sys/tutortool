import Stripe from "stripe";

let cached: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Lazily-constructed Stripe client. Throws a clear, caught-and-surfaced
 * error rather than crashing at module load when STRIPE_SECRET_KEY is
 * unset — TODO(connor): no Stripe test keys were provided during this
 * build, so this path is wired up but unexercised against a real account.
 * Fill in STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / STRIPE_CONNECT_CLIENT_ID
 * in .env.local (test mode) to activate it.
 */
export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured (STRIPE_SECRET_KEY is missing).");
  }
  if (!cached) {
    cached = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-06-24.dahlia",
    });
  }
  return cached;
}

export interface StripeAccountStatus {
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
}

/** Read-only account status check. Returns null on any error (e.g. a stale/test account id) rather than throwing, since this only drives a settings-page badge. */
export async function getStripeAccountStatus(accountId: string): Promise<StripeAccountStatus | null> {
  try {
    const stripe = getStripe();
    const account = await stripe.accounts.retrieve(accountId);
    return {
      chargesEnabled: Boolean(account.charges_enabled),
      detailsSubmitted: Boolean(account.details_submitted),
    };
  } catch {
    return null;
  }
}
