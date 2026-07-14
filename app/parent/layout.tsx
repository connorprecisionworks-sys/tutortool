import { AppShell } from "@/components/shell/app-shell";
import { PARENT_NAV } from "@/lib/nav";
import { requireParent } from "@/lib/auth/parent";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const parent = await requireParent();

  return (
    <AppShell navItems={PARENT_NAV} brand="TutorTool" userLabel={parent.email}>
      {children}
    </AppShell>
  );
}
