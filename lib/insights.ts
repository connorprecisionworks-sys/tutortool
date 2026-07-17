export function monthRange(now: Date = new Date()): { start: string; end: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

export function quarterRange(now: Date = new Date()): { start: string; end: string } {
  const quarterStartMonth = Math.floor(now.getUTCMonth() / 3) * 3;
  const start = new Date(Date.UTC(now.getUTCFullYear(), quarterStartMonth, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), quarterStartMonth + 3, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Last `count` calendar months including the current one, oldest first, as {label, start, end} ISO ranges. */
export function trailingMonths(count: number, now: Date = new Date()): { label: string; start: string; end: string }[] {
  const months: { label: string; start: string; end: string }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1));
    months.push({
      label: start.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
      start: start.toISOString(),
      end: end.toISOString(),
    });
  }
  return months;
}
