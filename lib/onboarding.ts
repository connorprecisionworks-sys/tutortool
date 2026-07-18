import { createClient } from "@/lib/supabase/server";
import { getStripeAccountStatus, isStripeConfigured } from "@/lib/stripe/client";
import type { TutorRow } from "@/lib/auth/tutor";

export interface OnboardingStep {
  key: "rates" | "availability" | "service" | "profile" | "student" | "stripe";
  label: string;
  description: string;
  href: string;
  cta: string;
  done: boolean;
  optional?: boolean;
}

export interface OnboardingStatus {
  steps: OnboardingStep[];
  requiredDone: number;
  requiredTotal: number;
  allRequiredDone: boolean;
  hasAnyData: boolean;
}

// The gate (C1) walks a tutor through exactly these, in this order, before
// the dashboard opens on their own. "student" and "stripe" are surfaced
// alongside them (same status object powers both the wizard and the
// dashboard's leftover-reminder card) but never block the gate.
export const ONBOARDING_GATE_STEP_KEYS: OnboardingStep["key"][] = [
  "rates",
  "availability",
  "service",
  "profile",
  "student",
];

/**
 * Every step's `done` is read straight off real rows (or the Stripe API for
 * the one external step) — there's no separate "onboarding_complete" flag to
 * fall out of sync with reality, so a step can never get permanently stuck
 * checked or unchecked relative to what's actually in the account.
 */
export async function getOnboardingStatus(tutor: TutorRow): Promise<OnboardingStatus> {
  const supabase = await createClient();

  const [
    { count: studentCount },
    { count: sessionCount },
    { count: availabilityCount },
    { count: serviceCount },
  ] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("tutor_id", tutor.id),
    supabase.from("sessions").select("id", { count: "exact", head: true }).eq("tutor_id", tutor.id),
    supabase.from("availability").select("id", { count: "exact", head: true }).eq("tutor_id", tutor.id),
    supabase.from("services").select("id", { count: "exact", head: true }).eq("tutor_id", tutor.id),
  ]);

  const requiredSteps: Omit<OnboardingStep, "optional">[] = [
    {
      key: "rates",
      label: "Set your standard rate",
      description: "Your default hourly rate and travel rule.",
      href: "/tutor/settings",
      cta: "Set rate",
      done: tutor.standard_rate_cents > 0,
    },
    {
      key: "availability",
      label: "Set your weekly availability",
      description: "The hours parents can book you.",
      href: "/tutor/schedule",
      cta: "Set availability",
      done: (availabilityCount ?? 0) > 0,
    },
    {
      key: "service",
      label: "Add a service",
      description: "A named, priced offering — e.g. a tutoring session.",
      href: "/tutor/settings/services/new",
      cta: "Add service",
      done: (serviceCount ?? 0) > 0,
    },
    {
      key: "profile",
      label: "Set your public page",
      description: "Pick a handle so parents can find and book you.",
      href: "/tutor/settings",
      cta: "Set handle",
      // Bio and visibility toggles are polish a tutor can add any time — the
      // handle is the one field the public page (and Q2/B4 booking links)
      // can't function without, so that alone is what gates this step.
      done: Boolean(tutor.handle),
    },
  ];

  const requiredDone = requiredSteps.filter((s) => s.done).length;
  const allRequiredDone = requiredDone === requiredSteps.length;

  // The Stripe step is optional, so it never affects allRequiredDone — and
  // once the required steps are all done the checklist stops rendering
  // entirely, so nothing ever reads this step's `done` value. Skipping the
  // Stripe API round-trip in that case keeps a live external call off the
  // dashboard's hot path for every already-set-up tutor's every visit.
  const stripeStatus =
    !allRequiredDone && isStripeConfigured() && tutor.stripe_account_id
      ? await getStripeAccountStatus(tutor.stripe_account_id)
      : null;

  const steps: OnboardingStep[] = [
    ...requiredSteps,
    {
      key: "student",
      label: "Add your first student",
      description: "Optional — we generate their Student Code automatically.",
      href: "/tutor/students/new",
      cta: "Add student",
      done: (studentCount ?? 0) > 0,
      optional: true,
    },
    {
      key: "stripe",
      label: "Connect Stripe to get paid",
      description: "Optional — invoice payment links go straight to you.",
      href: "/tutor/settings",
      cta: "Connect Stripe",
      done: Boolean(stripeStatus?.chargesEnabled),
      optional: true,
    },
  ];

  return {
    steps,
    requiredDone,
    requiredTotal: requiredSteps.length,
    allRequiredDone,
    hasAnyData: (studentCount ?? 0) > 0 || (sessionCount ?? 0) > 0,
  };
}
