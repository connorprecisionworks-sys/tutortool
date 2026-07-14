export interface ReminderTemplate {
  subject: string;
  body: string;
}

export type ReminderTemplates = Record<string, ReminderTemplate>;

export const DEFAULT_OFFSETS_DAYS = [0, 3, 7];

export function offsetKey(offsetDays: number): string {
  return `offset_${offsetDays}`;
}

export function interpolateTemplate(
  template: ReminderTemplate,
  vars: Record<string, string>
): ReminderTemplate {
  function fill(text: string): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
  }
  return { subject: fill(template.subject), body: fill(template.body) };
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
