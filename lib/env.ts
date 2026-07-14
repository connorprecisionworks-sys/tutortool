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
