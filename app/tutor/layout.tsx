import { AppShell } from "@/components/shell/app-shell";
import { TUTOR_NAV } from "@/lib/nav";
import { requireTutor } from "@/lib/auth/tutor";

export default async function TutorLayout({ children }: { children: React.ReactNode }) {
  const tutor = await requireTutor();

  return (
    <AppShell navItems={TUTOR_NAV} brand="Slate" userLabel={tutor.email}>
      {children}
    </AppShell>
  );
}
