// Shared between the "use server" save action and the "use client" live-check
// hook so format/reserved-word rules can never drift between what blocks a
// keystroke and what actually gets persisted.

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 48;

// Any URL-safe-ish handle: letters, numbers, hyphens, underscores, periods.
// Must start and end with a letter or number so a page never lives at a URL
// with a leading/trailing separator. Values are always lowercased before
// this runs (see normalizeHandle), so the charset only needs to cover a-z.
//
// The middle group's trailing char-class is mandatory (no `?`), matching
// the original HANDLE_RE this replaced — an optional-group version was
// tried once before and accepted 1-character handles by mistake, so the
// minimum match length is pinned at 1 + 1 + 1 = 3 chars (HANDLE_MIN).
export const HANDLE_RE = /^[a-z0-9](?:[a-z0-9_.-]{1,46}[a-z0-9])$/;

// A handle only ever resolves under /t/[handle] (see app/t/[handle]/page.tsx)
// — that segment has no static siblings, so it can never actually be
// route-shadowed by another top-level path like /book or /join, no matter
// what the handle is. What's reserved here instead is words that would read
// as impersonating a real system page if a tutor's page lived at
// /t/<word> — a parent mistaking /t/settings or /t/login for an actual
// Slate account page. Ordinary business-name words (book, join, new, ...)
// were removed after a review caught them being rejected with no real
// collision or impersonation risk behind it.
export const RESERVED_HANDLES = new Set([
  "login",
  "signup",
  "settings",
  "admin",
  "help",
  "support",
  "billing",
  "accept-terms",
]);

export function normalizeHandle(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Returns a user-facing error message, or null if the handle is well-formed. Does not check availability. */
export function validateHandleFormat(handle: string): string | null {
  // HANDLE_RE's {1,46} quantifier already bounds length to HANDLE_MIN..HANDLE_MAX
  // (1 + 1..46 + 1 = 3..48 chars) — no separate length check needed.
  if (!HANDLE_RE.test(handle)) {
    return `Use letters, numbers, hyphens, underscores, or periods (${HANDLE_MIN}-${HANDLE_MAX} characters), starting and ending with a letter or number.`;
  }
  if (RESERVED_HANDLES.has(handle)) {
    return "That handle is reserved — try another.";
  }
  return null;
}
