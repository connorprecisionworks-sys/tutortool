export function formatCents(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function centsFromHoursAndRate(minutes: number, rateCentsPerHour: number): number {
  return Math.round((minutes / 60) * rateCentsPerHour);
}
