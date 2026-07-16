/**
 * Isomorphic (server + client) base URL — falls back to the current origin
 * client-side instead of throwing (unlike lib/env.ts's appUrl(), used for
 * Stripe redirects) since a link failing to build here is recoverable in a
 * way a broken Stripe redirect isn't. Shared by every shareable-link
 * builder (booking links, Student Codes, the public profile URL) so the
 * fallback logic lives in exactly one place.
 */
export function publicAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== "undefined" ? window.location.origin : "");
}
