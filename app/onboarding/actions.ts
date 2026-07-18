"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { dollarsToCents } from "@/lib/money";

// Set once the gate is behind the tutor for this browser session (all
// required steps done, or they walked the wizard end to end and skipped
// what was left). No maxAge => a real session cookie, gone when the
// browser fully closes — matches the spec's "re-appears next login while
// incomplete." The value is the tutor's own id, not a bare "1": a plain
// flag would let tutor B silently skip the gate right after tutor A signs
// out in the same browser tab (a completely ordinary flow, not a rare
// edge case) since the cookie outlives the Supabase auth session. Scoping
// it to tutor.id costs nothing extra — app/tutor/layout.tsx already has
// the tutor row from requireTutor() before it ever reads this cookie.
const GATE_COOKIE = "slate_ob";

export interface OnboardingRateFormResult {
  error?: string;
}

export async function updateOnboardingRateAction(
  _prev: OnboardingRateFormResult,
  formData: FormData
): Promise<OnboardingRateFormResult> {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const standardRate = Number(formData.get("standard_rate_cents") ?? "0");
  if (Number.isNaN(standardRate) || standardRate <= 0) {
    return { error: "Enter your standard hourly rate." };
  }

  const travelRateRaw = String(formData.get("travel_rate_cents") ?? "").trim();
  const billTravelDefault = formData.get("bill_travel_default") === "on";

  const { error } = await supabase
    .from("tutors")
    .update({
      standard_rate_cents: dollarsToCents(standardRate),
      travel_rate_cents: travelRateRaw ? dollarsToCents(Number(travelRateRaw)) : null,
      bill_travel_default: billTravelDefault,
    })
    .eq("id", tutor.id);

  if (error) return { error: error.message };

  revalidatePath("/tutor/settings");
  return {};
}

/**
 * Marks the gate cleared for this session, no navigation. Two callers:
 * the dashboard's silent sync (tutor finished setup outside the wizard,
 * so nothing should re-gate mid-session) and the wizard's own "Go to
 * dashboard" button, which sets this then does the client-side push
 * itself — kept as a plain cookie write (no redirect() here) so both
 * call sites behave the same way.
 */
export async function ackOnboardingAction(): Promise<void> {
  const tutor = await requireTutor();
  const store = await cookies();
  store.set(GATE_COOKIE, tutor.id, { path: "/", sameSite: "lax" });
}
