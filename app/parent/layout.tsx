import { AppShell } from "@/components/shell/app-shell";
import { PARENT_NAV } from "@/lib/nav";
import { requireParent } from "@/lib/auth/parent";
import { PostHogIdentifier } from "@/components/posthog-identifier";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const parent = await requireParent();

  return (
    <AppShell navItems={PARENT_NAV} brand="Slate" userLabel={parent.email}>
      <PostHogIdentifier distinctId={parent.auth_user_id} name={parent.name} email={parent.email} role="parent" />
      {children}
    </AppShell>
  );
}
