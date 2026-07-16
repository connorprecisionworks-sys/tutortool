import { createClient } from "@/lib/supabase/server";
import { getStripeAccountStatus, isStripeConfigured } from "@/lib/stripe/client";
import type { TutorRow } from "@/lib/auth/tutor";

export interface OnboardingStep {
  key: "rates" | "student" | "parent" | "session" | "stripe";
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

/**
 * Every step's `done` is read straight off real rows (or the Stripe API for
 * the one external step) — there's no separate "onboarding_complete" flag to
 * fall out of sync with reality, so a step can never get permanently stuck
 * checked or unchecked relative to what's actually in the account.
 */
export async function getOnboardingStatus(tutor: TutorRow): Promise<OnboardingStatus> {
  const supabase = await createClient();

  const [{ data: students }, { count: sessionCount }, { data: parentLinks }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, archived, created_at, rate_type")
      .eq("tutor_id", tutor.id)
      .order("created_at", { ascending: true }),
    supabase.from("sessions").select("id", { count: "exact", head: true }).eq("tutor_id", tutor.id),
    supabase
      .from("parent_students")
      .select("id, clients!inner(tutor_id)")
      .eq("clients.tutor_id", tutor.id)
      .limit(1),
  ]);

  const studentCount = students?.length ?? 0;
  const firstStudent = students?.find((s) => !s.archived) ?? students?.[0] ?? null;
  // A student on a non-"standard" rate type (professional discount, friend,
  // low-income, pro bono) has an independently configured rate rule rather
  // than inheriting the tutor-level default — so a tutor who bills every
  // student a custom or pro-bono rate has genuinely finished this step even
  // if standard_rate_cents (which only matters for "standard"-rate
  // students) is still its unset default of 0.
  const hasStudentWithConfiguredRate = (students ?? []).some((s) => s.rate_type !== "standard");

  const requiredSteps: Omit<OnboardingStep, "optional">[] = [
    {
      key: "rates",
      label: "Set your rates",
      description: "Standard hourly rate and travel rule.",
      href: "/tutor/settings",
      cta: "Set rates",
      done: tutor.standard_rate_cents > 0 || hasStudentWithConfiguredRate,
    },
    {
      key: "student",
      label: "Add your first student",
      description: "We generate their Student Code automatically.",
      href: "/tutor/students/new",
      cta: "Add student",
      done: studentCount > 0,
    },
    {
      key: "parent",
      label: "Invite a parent",
      description: "Share the student's code or join link.",
      href: firstStudent ? `/tutor/students/${firstStudent.id}` : "/tutor/students/new",
      cta: "Invite parent",
      done: (parentLinks?.length ?? 0) > 0,
    },
    {
      key: "session",
      label: "Log your first session",
      description: "Duration and travel bill automatically.",
      href: "/tutor/sessions/new",
      cta: "Log session",
      done: (sessionCount ?? 0) > 0,
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
    hasAnyData: studentCount > 0 || (sessionCount ?? 0) > 0,
  };
}
