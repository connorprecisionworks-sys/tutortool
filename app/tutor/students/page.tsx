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

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const { archived } = await searchParams;
  const showArchived = archived === "1";

  const tutor = await requireTutor();
  const supabase = await createClient();
  const { data: students } = await supabase
    .from("clients")
    .select("*")
    .eq("tutor_id", tutor.id)
    .eq("archived", showArchived)
    .order("student_name");

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
          <table className="w-full text-sm">
            <thead className="bg-surface-sunken text-left text-text-secondary">
              <tr>
                <th className="px-5 py-3 font-medium">Student</th>
                <th className="px-5 py-3 font-medium">Payer</th>
                <th className="px-5 py-3 font-medium">Rate</th>
                <th className="px-5 py-3 font-medium">Effective rate</th>
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
                    <td className="px-5 py-3 text-text-secondary">{s.payer_name ?? "—"}</td>
                    <td className="px-5 py-3 text-text-secondary">{RATE_TYPE_LABELS[rateType]}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatCents(effective)}/hr</td>
                    <td className="px-5 py-3 text-right">
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
