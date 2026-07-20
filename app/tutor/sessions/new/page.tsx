import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SessionForm } from "@/components/sessions/session-form";
import { createSessionAction } from "@/app/tutor/sessions/actions";

export default async function NewSessionPage() {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const [{ data: clients }, { data: services }, { data: packages }, { data: recentSessions }] = await Promise.all([
    supabase.from("clients").select("*").eq("tutor_id", tutor.id).eq("archived", false).order("student_name"),
    supabase
      .from("services")
      .select("*")
      .eq("tutor_id", tutor.id)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("packages")
      .select("*")
      .eq("tutor_id", tutor.id)
      .eq("status", "active")
      .gt("remaining_sessions", 0)
      .order("created_at"),
    supabase
      .from("sessions")
      .select("client_id, service_id, duration_minutes, travel_minutes")
      .eq("tutor_id", tutor.id)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  if (!clients || clients.length === 0) {
    redirect("/tutor/students/new");
  }

  // Supabase JS has no DISTINCT ON — rows are already ordered most-recent
  // first, so keep only the first row seen per client to get each student's
  // last-logged service/duration/travel for prefilling a repeat session.
  const lastSessionByClient: Record<
    string,
    { service_id: string | null; duration_minutes: number; travel_minutes: number }
  > = {};
  for (const s of recentSessions ?? []) {
    if (!(s.client_id in lastSessionByClient)) {
      lastSessionByClient[s.client_id] = {
        service_id: s.service_id,
        duration_minutes: s.duration_minutes,
        travel_minutes: s.travel_minutes,
      };
    }
  }

  return (
    <div>
      <PageHeader
        title="Log session"
        description="Duration and travel time bill at the student's rate rule automatically."
        action={
          <Link href="/tutor/students">
            <Button variant="ghost" size="sm">
              Manage students
            </Button>
          </Link>
        }
      />
      <Card className="max-w-2xl">
        <SessionForm
          clients={clients}
          services={services ?? []}
          packages={packages ?? []}
          tutor={tutor}
          lastSessionByClient={lastSessionByClient}
          action={createSessionAction}
          onSuccessPath="/tutor/sessions"
        />
      </Card>
    </div>
  );
}
