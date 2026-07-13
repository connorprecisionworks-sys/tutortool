export type RateType =
  | "standard"
  | "professional_discount"
  | "friend"
  | "low_income"
  | "pro_bono";

export const RATE_TYPE_LABELS: Record<RateType, string> = {
  standard: "Standard",
  professional_discount: "Professional discount",
  friend: "Friend rate",
  low_income: "Low-income rate",
  pro_bono: "Pro bono",
};

// Rate types that need an explicit custom_rate_cents on the client/student record.
export const RATE_TYPES_REQUIRING_CUSTOM_RATE: RateType[] = [
  "professional_discount",
  "friend",
  "low_income",
];

/**
 * Resolve the hourly rate to bill at, in cents. Snapshot this onto the
 * session at log time so later rate changes never rewrite billing history.
 * TODO(connor): professional_discount is spec'd as "standard minus a set
 * percent OR a custom hourly number" but the data model only stores
 * custom_rate_cents. We treat custom_rate_cents as the resolved hourly
 * number for all three custom rate types and require it in the UI; if it's
 * ever missing we fall back to the standard rate rather than silently
 * charging $0. Revisit if you want percent-off stored instead.
 */
export function resolveEffectiveRateCents(
  rateType: RateType,
  customRateCents: number | null,
  standardRateCents: number
): number {
  if (rateType === "pro_bono") return 0;
  if (rateType === "standard") return standardRateCents;
  return customRateCents ?? standardRateCents;
}

export function resolveBillTravel(
  clientBillTravel: boolean | null,
  tutorBillTravelDefault: boolean
): boolean {
  return clientBillTravel ?? tutorBillTravelDefault;
}

export function resolveTravelRateCents(
  clientTravelRateCents: number | null,
  tutorTravelRateCents: number | null,
  effectiveRateCents: number
): number {
  return clientTravelRateCents ?? tutorTravelRateCents ?? effectiveRateCents;
}

/**
 * Session line amount = (duration/60 * effective rate) + (travel/60 * travel
 * rate, if billable). Summed as fractional cents and rounded exactly once at
 * the end so compounding rounding never drifts the total off by pennies.
 */
export function computeSessionAmountCents(params: {
  durationMinutes: number;
  travelMinutes: number;
  effectiveRateCents: number;
  billTravel: boolean;
  travelRateCents: number;
}): number {
  const { durationMinutes, travelMinutes, effectiveRateCents, billTravel, travelRateCents } = params;
  const sessionRaw = (durationMinutes / 60) * effectiveRateCents;
  const travelRaw = billTravel ? (travelMinutes / 60) * travelRateCents : 0;
  return Math.round(sessionRaw + travelRaw);
}

/**
 * "Value given" for philanthropic tracking: the gap between what a session
 * would have cost at the standard rate and what it actually billed, based on
 * session duration only (travel is not part of the impact story). Zero if
 * billing at or above standard.
 */
export function computeValueGivenCents(
  standardRateCents: number,
  effectiveRateCents: number,
  durationMinutes: number
): number {
  const gap = standardRateCents - effectiveRateCents;
  if (gap <= 0) return 0;
  return Math.round((gap * durationMinutes) / 60);
}
