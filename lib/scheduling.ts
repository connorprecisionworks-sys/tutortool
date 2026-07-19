export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * bookings.requested_start is stored as a literal wall-clock value stamped
 * as UTC (see the comment in app/parent/schedule/actions.ts) — there's no
 * real timezone conversion happening anywhere in this MVP. Formatting it
 * with the local Date getters (or toLocaleString, which uses the runtime's
 * local zone) would silently shift the displayed time by whatever offset
 * the server/browser happens to be in. Read the UTC getters instead so the
 * value that comes back out is exactly the value the tutor/parent typed in.
 */
export function formatBookingWhen(iso: string): string {
  const d = new Date(iso);
  const weekday = WEEKDAY_LABELS[d.getUTCDay()];
  const month = MONTH_LABELS[d.getUTCMonth()];
  const day = d.getUTCDate();
  const hours24 = d.getUTCHours();
  const minutes = d.getUTCMinutes();
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${weekday}, ${month} ${day}, ${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
}

/**
 * "Now," expressed in the same wall-clock-stamped-as-UTC convention used to
 * store bookings.requested_start (see formatBookingWhen above) — built from
 * the server process's LOCAL clock getters, on the single-timezone-MVP
 * assumption that the server and the tutor share a timezone. Using real UTC
 * now() here instead would drift by the server's actual UTC offset (e.g. a
 * 4pm-local booking stored as "16:00Z" would compare against "20:00Z" real
 * UTC now on an America/New_York server and look 4 hours in the past).
 */
/** Formats a "HH:MM" 24h time-of-day string (an availability window's start/end_time) as "H:MM AM/PM". */
export function formatTimeOfDay(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hours12 = h % 12 === 0 ? 12 : h % 12;
  return `${hours12}:${String(m).padStart(2, "0")} ${period}`;
}

export function nowAsStoredWallClockIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.000Z`;
}

/** Tomorrow's date as YYYY-MM-DD, the default first date shown on an availability-driven booking picker. */
export function tomorrowIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Formats an open-slot ISO timestamp's time-of-day only, reading UTC getters — same wall-clock-stamped-as-UTC convention as formatBookingWhen. */
export function formatIsoSlotTime(iso: string): string {
  const d = new Date(iso);
  const hours24 = d.getUTCHours();
  const minutes = d.getUTCMinutes();
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
}

/**
 * Buckets a flat list of open-slot ISO timestamps into Morning/Afternoon/
 * Evening sections for a more scannable picker — same getUTCHours() reading
 * as formatIsoSlotTime, so a slot lands in the same period a tutor would see
 * its time-of-day rendered as. Empty buckets are omitted; slots stay sorted
 * within each bucket since the input is already chronological.
 */
export function groupSlotsByPeriod(slots: string[]): { label: string; slots: string[] }[] {
  const buckets: { label: string; test: (h: number) => boolean }[] = [
    { label: "Morning", test: (h) => h < 12 },
    { label: "Afternoon", test: (h) => h >= 12 && h < 17 },
    { label: "Evening", test: (h) => h >= 17 },
  ];
  return buckets
    .map(({ label, test }) => ({ label, slots: slots.filter((s) => test(new Date(s).getUTCHours())) }))
    .filter((b) => b.slots.length > 0);
}
