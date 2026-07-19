import { interpolateTemplate, type ReminderTemplate, type ReminderTemplates } from "@/lib/reminders";
import { renderEmailShell } from "@/lib/email-shell";

export type EmailAudience = "parent" | "tutor";

export interface EmailTemplateDef {
  key: string;
  name: string;
  audience: EmailAudience;
  trigger: string;
  /** {{var}} tokens this template's real send site actually fills in. */
  variables: string[];
  defaultSubject: string;
  defaultBody: string;
  ctaLabel?: string;
}

/**
 * The 6 system templates — same copy as the D9 migration's backfill (keep
 * both in sync). This is the fallback used whenever a tutor's stored
 * reminder_templates is missing a key (e.g. a brand-new tutor row).
 */
export const SYSTEM_EMAIL_TEMPLATES: EmailTemplateDef[] = [
  {
    key: "booking_confirmation",
    name: "Booking confirmation",
    audience: "parent",
    trigger: "Sent right after a parent books a session.",
    variables: ["student", "tutor", "when", "link"],
    defaultSubject: "You're booked with {{tutor}}",
    defaultBody: "You're all set! {{student}}'s session with {{tutor}} is confirmed for {{when}}.",
    ctaLabel: "View booking",
  },
  {
    key: "session_reminder",
    name: "Session reminder",
    audience: "parent",
    trigger: "Sent once, shortly before an upcoming session.",
    variables: ["student", "tutor", "when"],
    defaultSubject: "Reminder — {{student}}'s session is coming up",
    defaultBody: "Just a heads up: {{student}}'s session with {{tutor}} is coming up on {{when}}. Let {{tutor}} know if anything's changed.",
  },
  {
    key: "offset_0",
    name: "Invoice due today",
    audience: "parent",
    trigger: "Sent the day an invoice becomes due.",
    variables: ["student", "tutor", "amount", "due_date", "link"],
    defaultSubject: "{{student}}'s invoice is ready",
    defaultBody: "Hi! {{tutor}} has an invoice ready for {{student}} — {{amount}}, due today. Pay anytime here: {{link}}",
    ctaLabel: "Pay invoice",
  },
  {
    key: "offset_3",
    name: "Invoice reminder — 3 days late",
    audience: "parent",
    trigger: "Sent once an invoice is 3 days past due.",
    variables: ["student", "tutor", "amount", "due_date", "link"],
    defaultSubject: "Quick nudge — {{student}}'s invoice",
    defaultBody: "Hi! Just floating this back up — {{student}}'s invoice ({{amount}}) was due a few days ago. No rush, pay whenever works: {{link}}",
    ctaLabel: "Pay invoice",
  },
  {
    key: "offset_7",
    name: "Invoice reminder — 7 days late",
    audience: "parent",
    trigger: "Sent once an invoice is 7 days past due.",
    variables: ["student", "tutor", "amount", "due_date", "link"],
    defaultSubject: "Following up — {{student}}'s invoice",
    defaultBody: "Hi! One more friendly check-in on {{student}}'s invoice ({{amount}}), due last week. Let {{tutor}} know if anything's off: {{link}}",
    ctaLabel: "Pay invoice",
  },
  {
    key: "invite_parent",
    name: "Parent invite",
    audience: "parent",
    trigger: "Sent when a tutor invites a parent to join Slate for a student.",
    variables: ["tutor", "student", "parent", "link", "code"],
    defaultSubject: "You're invited to Slate for {{student}}",
    defaultBody: "{{tutor}} uses Slate to share {{student}}'s sessions, notes, schedule, and invoices with you. Join here: {{link}} (or enter code {{code}}).",
    ctaLabel: "Join Slate",
  },
];

/** Sample values for the Email Center's live preview — never sent, display only. */
export const PREVIEW_SAMPLE_VARS: Record<string, string> = {
  student: "Jamie L.",
  tutor: "Alex Rivera",
  parent: "Jordan L.",
  when: "Wed, Jan 14 at 3:00 PM",
  amount: "$60.00",
  due_date: "1/14/2026",
  link: "https://slatetutor.app/t/example",
  code: "AB12CD",
};

export function resolveSystemTemplate(reminderTemplates: ReminderTemplates | null | undefined, key: string): ReminderTemplate {
  const def = SYSTEM_EMAIL_TEMPLATES.find((t) => t.key === key);
  const stored = reminderTemplates?.[key];
  if (stored?.subject && stored?.body) return stored;
  return { subject: def?.defaultSubject ?? "", body: def?.defaultBody ?? "" };
}

/**
 * Renders a template into the branded HTML shell, given raw (unfilled)
 * vars — interpolation happens here. Returns the plain interpolated body
 * text too (escaped, same as what goes into the HTML), since SMS sends
 * need the tutor's actual authored text, not a re-derived summary.
 */
export function renderTemplateEmailHtml(
  template: ReminderTemplate,
  vars: Record<string, string>,
  opts: { ctaLabel?: string; logoUrl?: string | null }
): { subject: string; body: string; html: string } {
  const filled = interpolateTemplate(template, vars);
  const bodyHtml = `<p style="margin:0;">${filled.body.replace(/\n/g, "<br/>")}</p>`;
  const link = vars.link?.trim();
  return {
    subject: filled.subject,
    body: filled.body,
    html: renderEmailShell({
      bodyHtml,
      logoUrl: opts.logoUrl,
      ...(opts.ctaLabel && link ? { ctaLabel: opts.ctaLabel, ctaHref: link } : {}),
    }),
  };
}

export interface CustomEmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}
