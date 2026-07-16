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

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tutor = await requireTutor();
  const supabase = await createClient();

  const [{ data: student }, { data: invites }, { data: redemptions }, { data: sends }] = await Promise.all([
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
  ]);

  if (!student) notFound();

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
        <Card className="max-w-2xl">
          <StudentForm student={student} action={updateStudentAction} onSuccessPath={`/tutor/students/${student.id}`} />
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
      </div>
    </div>
  );
}
