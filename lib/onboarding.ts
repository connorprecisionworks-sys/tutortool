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
      .select("id, archived, created_at")
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

  const stripeStatus =
    isStripeConfigured() && tutor.stripe_account_id
      ? await getStripeAccountStatus(tutor.stripe_account_id)
      : null;

  const steps: OnboardingStep[] = [
    {
      key: "rates",
      label: "Set your rates",
      description: "Standard hourly rate and travel rule.",
      href: "/tutor/settings",
      cta: "Set rates",
      done: tutor.standard_rate_cents > 0,
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

  const required = steps.filter((s) => !s.optional);
  const requiredDone = required.filter((s) => s.done).length;

  return {
    steps,
    requiredDone,
    requiredTotal: required.length,
    allRequiredDone: requiredDone === required.length,
    hasAnyData: studentCount > 0 || (sessionCount ?? 0) > 0,
  };
}
