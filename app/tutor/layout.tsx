import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { TUTOR_NAV } from "@/lib/nav";
import { requireTutor } from "@/lib/auth/tutor";
import { getOnboardingStatus } from "@/lib/onboarding";
import { PostHogIdentifier } from "@/components/posthog-identifier";

export default async function TutorLayout({ children }: { children: React.ReactNode }) {
  const tutor = await requireTutor();

  // C1 hard onboarding gate: while the cookie set by ackOnboardingAction is
  // missing (or belongs to a *different* tutor.id — e.g. someone signed out
  // and a new tutor signed up in the same browser tab), re-check the real
  // required-step state on every /tutor/* render and bounce to the
  // full-screen wizard if anything's outstanding. Reading the cookie first
  // means an already-set-up tutor (the steady state, and every request for
  // the rest of a session once the wizard is cleared) skips the extra
  // queries entirely.
  const gateAcked = (await cookies()).get("slate_ob")?.value === tutor.id;
  if (!gateAcked) {
    const status = await getOnboardingStatus(tutor);
    if (!status.allRequiredDone) redirect("/onboarding");
  }

  return (
    <AppShell navItems={TUTOR_NAV} brand="Slate" userLabel={tutor.email}>
      <PostHogIdentifier distinctId={tutor.auth_user_id} name={tutor.name} email={tutor.email} role="tutor" />
      {children}
    </AppShell>
  );
}
