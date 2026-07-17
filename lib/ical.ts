interface IcalSession {
  id: string;
  occurred_on: string;
  start_time: string | null;
  duration_minutes: number;
  location: string | null;
  student_name: string;
  service_name: string | null;
}

/** Escapes text per RFC 5545 §3.3.11 — backslash, comma, semicolon, and literal newlines. */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Folds a content line at 75 octets per RFC 5545 §3.1 — continuation lines start with a single space. */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 0) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  return parts.join("\r\n");
}

/** occurred_on + start_time in the app's "wall clock stamped as UTC" convention (see lib/scheduling.ts) — read as literal UTC, no real timezone conversion. */
function toIcsDateTime(occurredOn: string, time: string): string {
  const iso = `${occurredOn}T${time}Z`;
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

export function buildIcsFeed(tutorName: string, sessions: IcalSession[]): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Slate//Session Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(`${tutorName} — Slate Sessions`)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];

  for (const s of sessions) {
    const startTime = s.start_time ?? "00:00:00";
    const dtstart = toIcsDateTime(s.occurred_on, startTime);
    const startDate = new Date(`${s.occurred_on}T${startTime}Z`);
    const endDate = new Date(startDate.getTime() + s.duration_minutes * 60_000);
    const dtend = `${endDate.getUTCFullYear()}${pad(endDate.getUTCMonth() + 1)}${pad(endDate.getUTCDate())}T${pad(endDate.getUTCHours())}${pad(endDate.getUTCMinutes())}${pad(endDate.getUTCSeconds())}Z`;

    const summary = s.service_name ? `${s.student_name} — ${s.service_name}` : s.student_name;

    lines.push(
      "BEGIN:VEVENT",
      `UID:session-${s.id}@slate`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${escapeIcsText(summary)}`
    );
    if (s.location) lines.push(`LOCATION:${escapeIcsText(s.location)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return lines.map(foldLine).join("\r\n") + "\r\n";
}
