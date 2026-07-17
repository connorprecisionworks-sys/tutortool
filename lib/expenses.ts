export const EXPENSE_CATEGORIES = [
  "supplies",
  "curriculum",
  "training",
  "mileage",
  "fees",
  "other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  supplies: "Supplies",
  curriculum: "Curriculum",
  training: "Training",
  mileage: "Mileage",
  fees: "Fees",
  other: "Other",
};

/** Escapes a value for a single CSV field per RFC 4180 (quote-wrap on comma/quote/newline). */
export function csvField(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
