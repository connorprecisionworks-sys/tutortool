import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { SessionForm } from "@/components/sessions/session-form";
import { updateSessionAction } from "@/app/tutor/sessions/actions";
import { DeleteSessionButton } from "@/components/sessions/delete-session-button";
import { CancelSessionButton } from "@/components/sessions/cancel-session-button";
import { NoteForm } from "@/components/sessions/note-form";

const HANDLING_LABELS: Record<string, string> = {
  rollover: "rolled over to a credit",
  refund: "refunded",
  charge: "charged in full",
};

// A package session shares the "rollover"/"charge" handling values with
// non-package cancellations (see cancel-session-button.tsx's option
// labels), but means something different — the session is restored to (or
// kept drawn from) the package's balance rather than credited/charged in
// dollars. Same value, different label depending on session.package_id.
const PACKAGE_HANDLING_LABELS: Record<string, string> = {
  rollover: "restored to the package",
  charge: "kept drawn from the package",
};

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tutor = await requireTutor();
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("sessions")
    .select("*, invoices(status)")
    .eq("id", id)
    .eq("tutor_id", tutor.id)
    .maybeSingle();

  if (!session) notFound();

  const [{ data: clients }, { data: services }, { data: packages }, { data: note }] = await Promise.all([
    supabase.from("clients").select("*").eq("tutor_id", tutor.id).order("student_name"),
    // Includes inactive services too — a past session may reference one
    // that's since been turned off, and the form still needs its name.
    supabase.from("services").select("*").eq("tutor_id", tutor.id).order("name"),
    // Includes non-active packages too, for the same reason.
    supabase.from("packages").select("*").eq("tutor_id", tutor.id).order("created_at"),
    supabase.from("session_notes").select("*").eq("session_id", id).maybeSingle(),
  ]);

  const invoiceStatus = (session.invoices as unknown as { status: string } | null)?.status ?? null;
  const isCancelled = session.cancelled_at != null;
  // Mirrors cancel_session's own guard: only a *sent*/overdue invoice
  // blocks cancellation (mid-collection on a live invoice) — void that
  // first, same rule as any other edit to a billed session. No invoice,
  // a draft invoice, and a paid invoice are all fine (cancel_session
  // detaches a draft-invoice line item itself).
  const canCancel = !isCancelled && invoiceStatus !== "sent" && invoiceStatus !== "overdue";

  return (
    <div>
      <PageHeader
        title="Edit session"
        description={
          isCancelled
            ? "This session was cancelled."
            : session.status === "billed"
              ? "This session is billed and locked."
              : "Update the details below."
        }
        action={
          <div className="flex gap-2">
            {session.status === "logged" && !isCancelled && <DeleteSessionButton sessionId={session.id} />}
            {canCancel && <CancelSessionButton sessionId={session.id} isPackageSession={session.package_id != null} />}
          </div>
        }
      />
      <div className="space-y-6">
        {isCancelled && (
          <Card className="max-w-2xl border-border-strong">
            <p className="text-sm">
              Cancelled —{" "}
              {(session.package_id != null
                ? PACKAGE_HANDLING_LABELS[session.cancellation_handling ?? ""]
                : undefined) ??
                HANDLING_LABELS[session.cancellation_handling ?? ""] ??
                session.cancellation_handling}
              .
            </p>
          </Card>
        )}

        <Card className="max-w-2xl">
          {session.status === "billed" ? (
            <p className="text-sm text-text-secondary">
              Billed sessions can&apos;t be edited or deleted. Void the invoice first if this needs to change.
            </p>
          ) : isCancelled ? (
            <p className="text-sm text-text-secondary">Cancelled sessions keep their record as-is.</p>
          ) : (
            <SessionForm
              clients={clients ?? []}
              services={services ?? []}
              packages={packages ?? []}
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
