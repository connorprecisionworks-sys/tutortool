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

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tutor = await requireTutor();
  const supabase = await createClient();

  const [{ data: student }, { data: invites }, { data: redemptions }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).eq("tutor_id", tutor.id).maybeSingle(),
    supabase.from("invites").select("*").eq("student_id", id).order("created_at", { ascending: false }).limit(1),
    supabase
      .from("parent_students")
      .select("id, parent_name, parent_email, created_at")
      .eq("student_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!student) notFound();

  // At most one row per student can have status='active' (partial unique
  // index) and revoke/regenerate always leave the newest row as either
  // that active code or the last-issued revoked one — so the newest invite
  // row is always "the" current Student Code, active or not.
  const currentInvite = invites?.[0] ?? null;

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
          <h2 className="mb-3 text-sm font-semibold">Parent access</h2>
          <InviteParentSection
            studentId={student.id}
            currentInvite={currentInvite}
            redemptions={redemptions ?? []}
          />
        </Card>
      </div>
    </div>
  );
}
