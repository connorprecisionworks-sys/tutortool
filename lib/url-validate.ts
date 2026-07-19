/**
 * Rejects anything that isn't a genuine http(s) URL — `new URL(...)` alone
 * parses `javascript:alert(1)` successfully (protocol "javascript:"), and
 * every caller here eventually renders the stored value as a clickable
 * `href` (a session's meeting link, a link-type resource) for someone else
 * to click, including across the tutor/parent boundary. Without this, a
 * compromised or malicious tutor account could plant a script URI that
 * runs in the parent's authenticated session the moment they click "Join"
 * or "Open."
 */
export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
