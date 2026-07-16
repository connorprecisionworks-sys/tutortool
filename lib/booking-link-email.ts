import { escapeHtml } from "@/lib/html-escape";

export function buildBookingConfirmedEmailHtml({
  tutorName,
  studentName,
  parentName,
  whenText,
  sessionsUrl,
  logoUrl,
}: {
  tutorName: string;
  studentName: string;
  parentName: string | null;
  whenText: string;
  sessionsUrl: string;
  logoUrl: string | null;
}): string {
  const safeTutorName = escapeHtml(tutorName);
  const safeStudentName = escapeHtml(studentName);
  const safeParentName = parentName?.trim() ? escapeHtml(parentName.trim()) : null;
  const safeWhen = escapeHtml(whenText);
  const safeSessionsUrl = escapeHtml(sessionsUrl);
  const safeLogoUrl = logoUrl ? escapeHtml(logoUrl) : null;

  return `
<div style="background:#f7f7f7;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e3e3e3;border-radius:14px;padding:32px;">
    ${safeLogoUrl ? `<img src="${safeLogoUrl}" alt="Slate" height="24" style="height:24px;width:auto;margin-bottom:24px;" />` : ""}
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#161616;">Hi ${safeTutorName},</p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#161616;">
      ${safeParentName ? `${safeParentName} just` : "A parent just"} booked a session with
      <strong>${safeStudentName}</strong> for <strong>${safeWhen}</strong> from your booking link.
    </p>
    <a href="${safeSessionsUrl}" style="display:inline-block;background:#5f728c;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:10px;">
      View session
    </a>
  </div>
  <p style="max-width:480px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#8e8ea0;text-align:center;">
    Slate — Back office for tutors.
  </p>
</div>`.trim();
}
