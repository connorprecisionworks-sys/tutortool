import { escapeHtml } from "@/lib/html-escape";

export interface ReminderTemplate {
  subject: string;
  body: string;
}

export type ReminderTemplates = Record<string, ReminderTemplate>;

export const DEFAULT_OFFSETS_DAYS = [0, 3, 7];

/**
 * Upper bound for tutors.session_reminder_lead_hours, shared between its
 * form validation (app/tutor/settings/actions.ts) and the cron job's
 * lookahead window (app/api/cron/reminders/route.ts) so the two can't
 * drift apart — a lead time longer than what the cron actually scans for
 * would silently stop meaning what the Settings UI says it means (the
 * session would already be inside the scan window, and therefore "due",
 * the moment it's booked, regardless of the configured lead time).
 */
export const SESSION_REMINDER_MAX_LEAD_HOURS = 14 * 24;

export function offsetKey(offsetDays: number): string {
  return `offset_${offsetDays}`;
}

/**
 * Fills `{{var}}` placeholders in a tutor-editable subject/body template.
 * Every caller sends `body` straight into an HTML email (`<p>${body}</p>`)
 * — vars substituted there are escaped, since several (student name, "when"
 * text built from a booking/session) ultimately trace back to text an
 * anonymous visitor typed into a public booking form, not just tutor input.
 * `subject` is a plain email header, never rendered as HTML, so its
 * substitution stays unescaped — escaping there would show literal
 * "&amp;"-style entities in the inbox instead of the real character.
 */
export function interpolateTemplate(
  template: ReminderTemplate,
  vars: Record<string, string>
): ReminderTemplate {
  function fill(text: string, escapeValues: boolean): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      const value = vars[key] ?? "";
      return escapeValues ? escapeHtml(value) : value;
    });
  }
  return { subject: fill(template.subject, false), body: fill(template.body, true) };
}

/** Days between two YYYY-MM-DD dates (b - a), ignoring time-of-day. */
export function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(`${dateA}T00:00:00Z`).getTime();
  const b = new Date(`${dateB}T00:00:00Z`).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

/**
 * The latest cadence offset that's due by now, or null if none are due yet.
 * Using ">=" instead of exact-match means a missed cron run (outage,
 * misconfiguration) catches up on the next run instead of permanently
 * skipping that reminder — e.g. if day-3 was missed and the job next runs
 * on day 5, this still returns 3 (the largest offset <= 5). It intentionally
 * returns only the single most-recent applicable offset per run rather than
 * every offset <= daysPastDue, so a catch-up run sends one reminder, not a
 * burst of every offset it missed.
 */
export function latestApplicableOffset(offsets: number[], daysPastDue: number): number | null {
  let latest: number | null = null;
  for (const offset of offsets) {
    if (daysPastDue >= offset && (latest === null || offset > latest)) {
      latest = offset;
    }
  }
  return latest;
}
