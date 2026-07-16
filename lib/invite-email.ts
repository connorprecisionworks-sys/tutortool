/**
 * Every value below (tutor name, student name, parent name) is text a
 * tutor typed into a form — never trusted as safe HTML. Without escaping,
 * a name like `</p><a href="http://evil.example">Join Slate</a>` would
 * break out of its tag and let a malicious/compromised tutor account
 * plant a convincing phishing link inside an email a real parent trusts
 * because it came from Slate.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Inline-styled HTML for the invite email — email clients don't load
 * external stylesheets, so every rule has to live on the element. Colors
 * are the Slate palette's light-mode values (email always renders on a
 * light background, no dark-mode media query support to rely on).
 */
export function buildInviteEmailHtml({
  tutorName,
  studentName,
  parentName,
  link,
  code,
  logoUrl,
}: {
  tutorName: string;
  studentName: string;
  parentName?: string | null;
  link: string;
  code: string;
  logoUrl: string | null;
}): string {
  const safeTutorName = escapeHtml(tutorName);
  const safeStudentName = escapeHtml(studentName);
  const safeParentName = parentName?.trim() ? escapeHtml(parentName.trim()) : null;
  const safeLink = escapeHtml(link);
  const safeCode = escapeHtml(code);
  const safeLogoUrl = logoUrl ? escapeHtml(logoUrl) : null;
  const greeting = safeParentName ? `Hi ${safeParentName},` : "Hi,";

  return `
<div style="background:#f7f7f7;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e3e3e3;border-radius:14px;padding:32px;">
    ${safeLogoUrl ? `<img src="${safeLogoUrl}" alt="Slate" height="24" style="height:24px;width:auto;margin-bottom:24px;" />` : ""}
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#161616;">${greeting}</p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#161616;">
      ${safeTutorName} uses Slate to share ${safeStudentName}'s tutoring sessions, notes, schedule, and invoices
      with you. Tap below to join — it takes less than a minute.
    </p>
    <a href="${safeLink}" style="display:inline-block;background:#5f728c;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:10px;">
      Join Slate
    </a>
    <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#6e6e80;">
      Or go to ${safeLink} and enter code <strong style="color:#161616;letter-spacing:0.05em;">${safeCode}</strong>.
    </p>
  </div>
  <p style="max-width:480px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#8e8ea0;text-align:center;">
    Slate — Back office for tutors.
  </p>
</div>`.trim();
}
