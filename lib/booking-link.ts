/**
 * Isomorphic (server + client) booking-link builder — same fallback
 * approach as lib/invite-link.ts's studentJoinLink: falls back to the
 * current origin instead of throwing (unlike lib/env.ts's appUrl(), used
 * for Stripe redirects) since a booking link failing to build is
 * recoverable in a way a broken Stripe redirect isn't.
 */
export function bookingLink(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/book/${token}`;
}
