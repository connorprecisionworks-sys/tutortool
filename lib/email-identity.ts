/**
 * A parent-facing email should feel like it comes from the tutor, not a
 * faceless platform — but the actual From address always stays Slate's
 * verified sending domain (a tutor's raw address would fail SPF/DKIM/
 * DMARC). Display name carries the tutor's identity instead, and Reply-To
 * routes a parent's reply straight to the tutor.
 */
export function parentFacingIdentity(tutor: { name: string; email: string }): {
  fromName: string;
  replyTo: string;
} {
  return { fromName: `${tutor.name} via Slate`, replyTo: tutor.email };
}
