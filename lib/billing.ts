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
 *
 * When servicePriceCents is set (the session is billed against a named
 * Service, see Q1), it replaces the duration*rate portion with the
 * service's flat price — travel still bills additively on top. Mirrors the
 * SQL source of truth in session_amount_cents()
 * (supabase/migrations/20260716130000_q1_services.sql).
 */
export function computeSessionAmountCents(params: {
  durationMinutes: number;
  travelMinutes: number;
  effectiveRateCents: number;
  billTravel: boolean;
  travelRateCents: number;
  servicePriceCents?: number | null;
}): number {
  const { durationMinutes, travelMinutes, effectiveRateCents, billTravel, travelRateCents, servicePriceCents } =
    params;
  const sessionRaw = servicePriceCents != null ? servicePriceCents : (durationMinutes / 60) * effectiveRateCents;
  const travelRaw = billTravel ? (travelMinutes / 60) * travelRateCents : 0;
  return Math.round(sessionRaw + travelRaw);
}

/**
 * "Value given" for philanthropic tracking: the gap between what a session
 * would have cost at the standard rate and what it actually billed, based on
 * session duration only (travel is not part of the impact story). Zero if
 * billing at or above standard.
 * Service-priced sessions (Q1) are excluded before this is ever called —
 * see the `service_price_cents != null` skip in the dashboard rollup
 * (app/tutor/page.tsx) — since "gap vs. standard rate" isn't meaningful for
 * a flat product price.
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

// Due-date math and line-item summation for invoices live in Postgres
// (send_invoice / recompute_invoice_totals in
// supabase/migrations/20260714000100_p3_invoice_functions.sql), not here —
// those are the actual source of truth since invoice mutations only happen
// through those SECURITY DEFINER functions, never from the client.
