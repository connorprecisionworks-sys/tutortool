import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { getOnboardingStatus, ONBOARDING_GATE_STEP_KEYS, type OnboardingStep } from "@/lib/onboarding";
import { StepShell } from "@/components/onboarding/step-shell";
import { RateStep } from "@/components/onboarding/rate-step";
import { AvailabilityStep } from "@/components/onboarding/availability-step";
import { ServiceStep } from "@/components/onboarding/service-step";
import { ProfileStep } from "@/components/onboarding/profile-step";
import { StudentStep } from "@/components/onboarding/student-step";
import { tutorCodeLink } from "@/lib/tutor-code-link";

const STEP_COPY: Record<OnboardingStep["key"], { title: string; description: string }> = {
  rates: { title: "Set your standard rate", description: "This is the default every new student inherits." },
  availability: { title: "Set your weekly availability", description: "The hours parents can request or book against." },
  service: { title: "Add a service", description: "A named, priced offering to bill against — a session, a package, whatever you sell." },
  profile: { title: "Set up your public page", description: "A shareable link with your bio and services. No login required to view." },
  student: { title: "Add your first student", description: "Optional — skip this and add students any time." },
  stripe: { title: "Connect Stripe", description: "" },
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const { step } = await searchParams;
  const tutor = await requireTutor();
  const supabase = await createClient();

  const [status, { data: availability }] = await Promise.all([
    getOnboardingStatus(tutor),
    supabase.from("availability").select("*").eq("tutor_id", tutor.id).order("weekday"),
  ]);

  const stepsByKey = new Map(status.steps.map((s) => [s.key, s]));
  const requestedKey = ONBOARDING_GATE_STEP_KEYS.includes(step as OnboardingStep["key"])
    ? (step as OnboardingStep["key"])
    : null;
  // A requested step is honored even if it's already done (revisiting to
  // change something) or ahead of the first gap (explicit "Skip for now"
  // navigation) — only an unrecognized/missing ?step falls back to the
  // first incomplete required step, or the last (optional) step once every
  // required one is already satisfied.
  const firstIncomplete = ONBOARDING_GATE_STEP_KEYS.find((key) => !stepsByKey.get(key)?.done);
  const currentKey = requestedKey ?? firstIncomplete ?? "student";
  const currentIndex = ONBOARDING_GATE_STEP_KEYS.indexOf(currentKey);
  const totalSteps = ONBOARDING_GATE_STEP_KEYS.length;
  const nextKey = ONBOARDING_GATE_STEP_KEYS[currentIndex + 1];
  const nextHref = nextKey ? `/onboarding?step=${nextKey}` : "/onboarding?step=student";
  const copy = STEP_COPY[currentKey];
  const isLastStep = currentIndex === totalSteps - 1;

  return (
    <StepShell
      stepNumber={currentIndex + 1}
      totalSteps={totalSteps}
      title={copy.title}
      description={copy.description}
      skipHref={isLastStep ? undefined : nextHref}
    >
      {currentKey === "rates" && <RateStep tutor={tutor} nextHref={nextHref} />}
      {currentKey === "availability" && <AvailabilityStep availability={availability ?? []} nextHref={nextHref} />}
      {currentKey === "service" && <ServiceStep nextHref={nextHref} />}
      {currentKey === "profile" && <ProfileStep tutor={tutor} nextHref={nextHref} />}
      {currentKey === "student" && <StudentStep tutorCodeLink={tutorCodeLink(tutor.tutor_code)} />}
    </StepShell>
  );
}
