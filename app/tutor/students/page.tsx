import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RATE_TYPE_LABELS, type RateType } from "@/lib/billing";
import { formatCents } from "@/lib/money";
import { DeleteStudentRowButton } from "@/components/students/delete-student-row-button";
import { CopyStudentCodeButton } from "@/components/students/copy-student-code-button";
import { PendingStudentRow } from "@/components/students/pending-student-row";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const { archived } = await searchParams;
  const showArchived = archived === "1";

  const tutor = await requireTutor();
  const supabase = await createClient();
  // Pending-review students are always freshly-created and never archived,
  // so the "new from parent signups" card only ever makes sense on the
  // active tab — fetching (and rendering) it on the archived tab too would
  // show the exact same actionable card in a view a tutor expects to be
  // read-only history.
  const [{ data: students }, { data: pendingStudents }, { data: allActiveStudents }] = await Promise.all([
    supabase
      .from("clients")
      .select("*, invites(code, status)")
      .eq("tutor_id", tutor.id)
      .eq("archived", showArchived)
      .order("student_name"),
    showArchived
      ? Promise.resolve({ data: null })
      : supabase
          .from("clients")
          .select("id, student_name")
          .eq("tutor_id", tutor.id)
          .eq("pending_parent_review", true)
          .order("student_name"),
    supabase.from("clients").select("id, student_name").eq("tutor_id", tutor.id).eq("archived", false).order("student_name"),
  ]);

  return (
    <div>
      <PageHeader
        title="Students"
        description="The families you tutor and their rate rules."
        action={
          <Link href="/tutor/students/new">
            <Button>Add student</Button>
          </Link>
        }
      />

      {pendingStudents && pendingStudents.length > 0 && (
        <Card className="mb-6">
          <h2 className="mb-1 text-sm font-semibold">New from parent signups</h2>
          <p className="mb-3 text-sm text-text-secondary">
            A parent joined with your tutor code and added this child. Confirm it as a new student, or merge
            it into an existing one if it&apos;s a duplicate.
          </p>
          <ul className="divide-y divide-border">
            {pendingStudents.map((p) => (
              <PendingStudentRow
                key={p.id}
                studentId={p.id}
                studentName={p.student_name}
                otherStudents={(allActiveStudents ?? []).filter((s) => s.id !== p.id)}
              />
            ))}
          </ul>
        </Card>
      )}

      <div className="mb-4 flex gap-2 text-sm">
        <Link
          href="/tutor/students"
          className={!showArchived ? "font-medium text-text" : "text-text-secondary hover:text-text"}
        >
          Active
        </Link>
        <span className="text-text-tertiary">·</span>
        <Link
          href="/tutor/students?archived=1"
          className={showArchived ? "font-medium text-text" : "text-text-secondary hover:text-text"}
        >
          Archived
        </Link>
      </div>

      {!students || students.length === 0 ? (
        <EmptyState
          message={
            showArchived
              ? "No archived students."
              : "No students yet. Add your first student to start billing."
          }
          action={
            !showArchived && (
              <Link href="/tutor/students/new">
                <Button>Add student</Button>
              </Link>
            )
          }
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="rtable w-full text-sm">
            <thead className="bg-surface-sunken text-left text-text-secondary">
              <tr>
                <th className="px-5 py-3 font-medium">Student</th>
                <th className="px-5 py-3 font-medium">Payer</th>
                <th className="px-5 py-3 font-medium">Rate</th>
                <th className="px-5 py-3 font-medium">Effective rate</th>
                <th className="px-5 py-3 font-medium">Student Code</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const rateType = s.rate_type as RateType;
                const effective =
                  rateType === "pro_bono"
                    ? 0
                    : rateType === "standard"
                      ? tutor.standard_rate_cents
                      : (s.custom_rate_cents ?? tutor.standard_rate_cents);
                const activeCode = s.invites?.find((inv) => inv.status === "active")?.code ?? null;
                return (
                  <tr key={s.id} className="border-t border-border hover:bg-hover">
                    <td className="px-5 py-3">
                      <Link href={`/tutor/students/${s.id}`} className="font-medium">
                        {s.student_name}
                      </Link>
                      {s.is_philanthropic && (
                        <span className="ml-2 text-xs text-text-tertiary">community impact</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-text-secondary" data-label="Payer">
                      {s.payer_name ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-text-secondary" data-label="Rate">
                      {RATE_TYPE_LABELS[rateType]}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums" data-label="Effective rate">
                      {formatCents(effective)}/hr
                    </td>
                    <td className="px-5 py-3" data-label="Student Code">
                      {activeCode ? (
                        <CopyStudentCodeButton code={activeCode} />
                      ) : (
                        <span className="text-xs text-text-tertiary">revoked</span>
                      )}
                    </td>
                    <td className="cell-action px-5 py-3 text-right">
                      <DeleteStudentRowButton studentId={s.id} studentName={s.student_name} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
