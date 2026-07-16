import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { SessionForm } from "@/components/sessions/session-form";
import { updateSessionAction } from "@/app/tutor/sessions/actions";
import { DeleteSessionButton } from "@/components/sessions/delete-session-button";
import { NoteForm } from "@/components/sessions/note-form";

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

  const [{ data: clients }, { data: services }, { data: note }] = await Promise.all([
    supabase.from("clients").select("*").eq("tutor_id", tutor.id).order("student_name"),
    // Includes inactive services too — a past session may reference one
    // that's since been turned off, and the form still needs its name.
    supabase.from("services").select("*").eq("tutor_id", tutor.id).order("name"),
    supabase.from("session_notes").select("*").eq("session_id", id).maybeSingle(),
  ]);

  return (
    <div>
      <PageHeader
        title="Edit session"
        description={session.status === "billed" ? "This session is billed and locked." : "Update the details below."}
        action={session.status === "logged" && <DeleteSessionButton sessionId={session.id} />}
      />
      <div className="space-y-6">
        <Card className="max-w-2xl">
          {session.status === "billed" ? (
            <p className="text-sm text-text-secondary">
              Billed sessions can&apos;t be edited or deleted. Void the invoice first if this needs to change.
            </p>
          ) : (
            <SessionForm
              clients={clients ?? []}
              services={services ?? []}
              tutor={tutor}
              session={session}
              action={updateSessionAction}
              onSuccessPath="/tutor/sessions"
            />
          )}
        </Card>

        <Card className="max-w-2xl">
          <h2 className="mb-3 text-sm font-semibold">Session note</h2>
          <NoteForm sessionId={session.id} note={note} />
        </Card>
      </div>
    </div>
  );
}
