import { AppShell } from "@/components/shell/app-shell";
import { TUTOR_NAV } from "@/lib/nav";
import { requireTutor } from "@/lib/auth/tutor";
import { PostHogIdentifier } from "@/components/posthog-identifier";

export default async function TutorLayout({ children }: { children: React.ReactNode }) {
  const tutor = await requireTutor();

  return (
    <AppShell navItems={TUTOR_NAV} brand="Slate" userLabel={tutor.email}>
      <PostHogIdentifier distinctId={tutor.auth_user_id} name={tutor.name} email={tutor.email} role="tutor" />
      {children}
    </AppShell>
  );
}
