import { escapeHtml } from "@/lib/html-escape";

/**
 * The one branded HTML wrapper every Slate email renders into — logo,
 * white card, optional CTA button, footer. Inline styles only (email
 * clients don't load external stylesheets); light-mode Slate palette only
 * (no dark-mode media query support to rely on in an inbox). `bodyHtml` is
 * caller-supplied HTML, not raw text — callers are responsible for
 * escaping any interpolated values before this point (see
 * lib/reminders.ts's interpolateTemplate, which already does).
 */
export function renderEmailShell({
  bodyHtml,
  ctaLabel,
  ctaHref,
  logoUrl,
}: {
  bodyHtml: string;
  ctaLabel?: string;
  ctaHref?: string;
  logoUrl?: string | null;
}): string {
  const safeCtaHref = ctaHref ? escapeHtml(ctaHref) : null;
  const safeCtaLabel = ctaLabel ? escapeHtml(ctaLabel) : null;
  const safeLogoUrl = logoUrl ? escapeHtml(logoUrl) : null;

  return `
<div style="background:#f7f7f7;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e3e3e3;border-radius:14px;padding:32px;">
    ${safeLogoUrl ? `<img src="${safeLogoUrl}" alt="Slate" height="24" style="height:24px;width:auto;margin-bottom:24px;" />` : ""}
    <div style="margin:0;font-size:15px;line-height:1.6;color:#161616;">${bodyHtml}</div>
    ${
      safeCtaHref && safeCtaLabel
        ? `<a href="${safeCtaHref}" style="display:inline-block;margin-top:24px;background:#5f728c;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:10px;">${safeCtaLabel}</a>`
        : ""
    }
  </div>
  <p style="max-width:480px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#8e8ea0;text-align:center;">
    Slate — Back office for tutors.
  </p>
</div>`.trim();
}
