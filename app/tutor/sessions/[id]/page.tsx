import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { SessionForm } from "@/components/sessions/session-form";
import { updateSessionAction } from "@/app/tutor/sessions/actions";
import { DeleteSessionButton } from "@/components/sessions/delete-session-button";

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tutor = await requireTutor();
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", id)
    .eq("tutor_id", tutor.id)
    .maybeSingle();

  if (!session) notFound();

  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .eq("tutor_id", tutor.id)
    .order("student_name");

  return (
    <div>
      <PageHeader
        title="Edit session"
        description={session.status === "billed" ? "This session is billed and locked." : "Update the details below."}
        action={session.status === "logged" && <DeleteSessionButton sessionId={session.id} />}
      />
      <Card className="max-w-2xl">
        {session.status === "billed" ? (
          <p className="text-sm text-text-secondary">
            Billed sessions can&apos;t be edited or deleted. Void the invoice first if this needs to change.
          </p>
        ) : (
          <SessionForm
            clients={clients ?? []}
            tutor={tutor}
            session={session}
            action={updateSessionAction}
            onSuccessPath="/tutor/sessions"
          />
        )}
      </Card>
    </div>
  );
}
