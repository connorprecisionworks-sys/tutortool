/**
 * Formats a plain `date`-column value ("YYYY-MM-DD", e.g. sessions.occurred_on,
 * invoices.due_date) as M/D/YYYY. Parses the string directly instead of
 * `new Date(...)` — a plain date has no time/zone component, so reparsing it
 * as a Date and re-extracting fields through a browser's local timezone can
 * roll it back a day.
 */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${Number(month)}/${Number(day)}/${year}`;
}

/**
 * Formats the date portion of a real timestamptz value (e.g. invoices.paid_at,
 * parent_students.created_at) as M/D/YYYY. Pinned to UTC rather than the
 * runtime's local timezone — several call sites render during SSR in a
 * Server Component, where "local" means the server process's timezone, not
 * the viewer's browser; without pinning, the same timestamp could render a
 * different calendar date per deploy environment. Matches formatDate's
 * plain-date columns, which are timezone-invariant by construction.
 */
export function formatTimestampDate(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
