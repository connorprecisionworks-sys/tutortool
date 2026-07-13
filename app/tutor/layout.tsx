import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/shell/app-shell";
import { TUTOR_NAV } from "@/lib/nav";

export default async function TutorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <AppShell navItems={TUTOR_NAV} brand="TutorTool" userLabel={user.email ?? undefined}>
      {children}
    </AppShell>
  );
}
