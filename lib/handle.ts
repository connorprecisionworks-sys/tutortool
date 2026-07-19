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

// Top-level route segments this app actually serves, plus a few common
// admin-ish words — a handle matching one of these would either 404 forever
// (shadowed by the real route) or read as an impersonation of a system page.
export const RESERVED_HANDLES = new Set([
  "t",
  "tutor",
  "parent",
  "api",
  "book",
  "join",
  "login",
  "signup",
  "onboarding",
  "settings",
  "about",
  "terms",
  "privacy",
  "accept-terms",
  "resources",
  "admin",
  "www",
  "app",
  "auth",
  "static",
  "public",
  "help",
  "support",
  "billing",
  "dashboard",
  "new",
]);

export function normalizeHandle(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Returns a user-facing error message, or null if the handle is well-formed. Does not check availability. */
export function validateHandleFormat(handle: string): string | null {
  if (handle.length < HANDLE_MIN || handle.length > HANDLE_MAX || !HANDLE_RE.test(handle)) {
    return `Use letters, numbers, hyphens, underscores, or periods (${HANDLE_MIN}-${HANDLE_MAX} characters), starting and ending with a letter or number.`;
  }
  if (RESERVED_HANDLES.has(handle)) {
    return "That handle is reserved — try another.";
  }
  return null;
}
