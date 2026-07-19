import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StudentForm } from "@/components/students/student-form";
import { updateStudentAction } from "@/app/tutor/students/actions";
import { ArchiveToggleButton } from "@/components/students/archive-toggle-button";
import { DeleteStudentButton } from "@/components/students/delete-student-button";
import { InviteParentSection } from "@/components/students/invite-parent-section";
import { studentJoinLink } from "@/lib/invite-link";
import { generateJoinQrSvg } from "@/lib/qrcode";
import { isEmailConfigured } from "@/lib/email";
import { isSmsConfigured } from "@/lib/sms";
import { formatCents } from "@/lib/money";
import { AutoInvoiceSettingsCard } from "@/components/students/auto-invoice-settings-card";
import { MessageParentCard } from "@/components/students/message-parent-card";
import { computeSessionAmountCents } from "@/lib/billing";

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tutor = await requireTutor();
  const supabase = await createClient();

  const [{ data: student }, { data: invites }, { data: redemptions }, { data: sends }, { data: credits }, { data: packages }, { data: unbilledSessions }] =
    await Promise.all([
      supabase.from("clients").select("*").eq("id", id).eq("tutor_id", tutor.id).maybeSingle(),
      supabase.from("invites").select("*").eq("student_id", id).order("created_at", { ascending: false }).limit(1),
      supabase
        .from("parent_students")
        .select("id, parent_name, parent_email, created_at")
        .eq("student_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("invite_sends")
        .select("id, parent_name, parent_email, sent_at")
        .eq("student_id", id)
        .order("sent_at", { ascending: false }),
      supabase.from("credits").select("remaining_cents").eq("client_id", id).gt("remaining_cents", 0),
      supabase
        .from("packages")
        .select("*")
        .or(`client_id.eq.${id},client_id.is.null`)
        .eq("status", "active")
        .order("created_at"),
      // Same eligibility filter as run_client_auto_invoice() — a read-only
      // preview of what auto-invoicing would bill right now, no side effects.
      supabase
        .from("sessions")
        .select("duration_minutes, travel_minutes, effective_rate_cents, bill_travel, travel_rate_cents, service_price_cents")
        .eq("tutor_id", tutor.id)
        .eq("client_id", id)
        .is("invoice_id", null)
        .eq("status", "logged")
        .is("cancelled_at", null)
        .is("package_id", null),
    ]);

  if (!student) notFound();

  const availableCreditCents = (credits ?? []).reduce((sum, c) => sum + c.remaining_cents, 0);

  const previewTotalCents = (unbilledSessions ?? []).reduce(
    (sum, s) =>
      sum +
      computeSessionAmountCents({
        durationMinutes: s.duration_minutes,
        travelMinutes: s.travel_minutes,
        effectiveRateCents: s.effective_rate_cents,
        billTravel: s.bill_travel,
        travelRateCents: s.travel_rate_cents ?? 0,
        servicePriceCents: s.service_price_cents,
      }),
    0
  );

  // At most one row per student can have status='active' (partial unique
  // index) and revoke/regenerate always leave the newest row as either
  // that active code or the last-issued revoked one — so the newest invite
  // row is always "the" current Student Code, active or not.
  const currentInvite = invites?.[0] ?? null;
  const joinLink = currentInvite?.status === "active" ? studentJoinLink(currentInvite.code) : null;
  const qrSvg = joinLink ? await generateJoinQrSvg(joinLink) : null;

  // "Pending" is derived, not stored: a send is only pending until a
  // parent_students row exists for this student with a matching email —
  // never a separate status flag that could drift from reality.
  const joinedEmails = new Set((redemptions ?? []).map((r) => r.parent_email.toLowerCase()));
  const pendingInvites = (sends ?? []).filter((s) => !joinedEmails.has(s.parent_email.toLowerCase()));

  return (
    <div>
      <PageHeader
        title={student.student_name}
        description={student.archived ? "Archived — no new sessions or invoices." : "Edit rate rule and contact info."}
        action={
          <div className="flex gap-2">
            <ArchiveToggleButton studentId={student.id} archived={student.archived} />
            <DeleteStudentButton studentId={student.id} studentName={student.student_name} />
          </div>
        }
      />
      <div className="space-y-6">
        {availableCreditCents > 0 && (
          <Card className="max-w-2xl">
            <p className="text-sm">
              <span className="font-medium">{formatCents(availableCreditCents)}</span>{" "}
              <span className="text-text-secondary">in credit — applied automatically to their next invoice.</span>
            </p>
          </Card>
        )}

        {packages && packages.length > 0 && (
          <Card className="max-w-2xl">
            <h2 className="mb-2 text-sm font-semibold">Active packages</h2>
            <ul className="space-y-1 text-sm">
              {packages.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span>
                    {p.name}
                    {p.client_id == null && <span className="ml-2 text-xs text-text-tertiary">General — shared</span>}
                  </span>
                  <span className="text-text-secondary">
                    {p.remaining_sessions} of {p.total_sessions} left
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <AutoInvoiceSettingsCard
          clientId={student.id}
          enabled={student.auto_invoice_enabled}
          trigger={student.auto_invoice_trigger}
          nextDate={student.auto_invoice_next_date}
          previewCount={unbilledSessions?.length ?? 0}
          previewTotalCents={previewTotalCents}
          resendConfigured={isEmailConfigured()}
        />

        <Card className="max-w-2xl">
          <StudentForm
            student={student}
            action={updateStudentAction}
            onSuccessPath={`/tutor/students/${student.id}`}
            smsConfigured={isSmsConfigured()}
          />
        </Card>

        <Card className="max-w-2xl">
          <h2 className="mb-3 text-sm font-semibold">Invite parent</h2>
          <InviteParentSection
            studentId={student.id}
            studentName={student.student_name}
            currentInvite={currentInvite}
            joinLink={joinLink}
            qrSvg={qrSvg}
            emailConfigured={isEmailConfigured()}
            redemptions={redemptions ?? []}
            pendingInvites={pendingInvites}
          />
        </Card>

        <MessageParentCard
          clientId={student.id}
          payerEmail={student.payer_email}
          resendConfigured={isEmailConfigured()}
        />
      </div>
    </div>
  );
}
