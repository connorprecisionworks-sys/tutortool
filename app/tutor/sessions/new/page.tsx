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

  const [{ data: clients }, { data: services }, { data: packages }] = await Promise.all([
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
  ]);

  if (!clients || clients.length === 0) {
    redirect("/tutor/students/new");
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
          action={createSessionAction}
          onSuccessPath="/tutor/sessions"
        />
      </Card>
    </div>
  );
}
