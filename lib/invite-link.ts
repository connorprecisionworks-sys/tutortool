/**
 * Isomorphic (server + client) join-link builder. NEXT_PUBLIC_APP_URL is
 * inlined into the client bundle at build time same as any NEXT_PUBLIC_ var,
 * so this doesn't need a server round-trip — but falls back to the current
 * origin when it's unset (e.g. local dev without a .env.local) rather than
 * throwing like lib/env.ts's appUrl() does for Stripe redirects, since a
 * broken join link is recoverable (copy the raw code instead) in a way a
 * broken Stripe redirect isn't.
 */
export function studentJoinLink(code: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/join?code=${code}`;
}
