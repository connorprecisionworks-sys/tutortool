import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { RecurringSessionForm } from "@/components/sessions/recurring-session-form";
import { createRecurringSessionAction } from "@/app/tutor/sessions/recurring/actions";

export default async function NewRecurringSessionPage() {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const [{ data: clients }, { data: services }] = await Promise.all([
    supabase.from("clients").select("*").eq("tutor_id", tutor.id).eq("archived", false).order("student_name"),
    supabase.from("services").select("*").eq("tutor_id", tutor.id).eq("is_active", true).order("name"),
  ]);

  if (!clients || clients.length === 0) {
    redirect("/tutor/students/new");
  }

  return (
    <div>
      <PageHeader
        title="New recurring session"
        description="A fixed weekly slot for a student. Upcoming sessions are created automatically."
      />
      <Card className="max-w-2xl">
        <RecurringSessionForm clients={clients} services={services ?? []} action={createRecurringSessionAction} onSuccessPath="/tutor/sessions/recurring" />
      </Card>
    </div>
  );
}
