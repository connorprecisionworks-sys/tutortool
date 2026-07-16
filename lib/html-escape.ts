/**
 * Every email builder in this app interpolates tutor- or parent-entered
 * text (names, etc.) into inline HTML — never trust it as safe markup.
 * Without escaping, a name like `</p><a href="http://evil.example">Join
 * Slate</a>` would break out of its tag and let a compromised account
 * plant a convincing phishing link inside an email a recipient trusts
 * because it came from Slate.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
