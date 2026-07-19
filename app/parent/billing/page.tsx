import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireParent } from "@/lib/auth/parent";
import { getLinkedStudents } from "@/lib/auth/linked-students";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { StatusDot, type StatusKind } from "@/components/ui/status-dot";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/date";

export default async function ParentBillingPage() {
  const parentUser = await requireParent();
  const supabase = await createClient();

  const students = await getLinkedStudents(supabase, parentUser.id);

  if (students.length === 0) {
    return (
      <div>
        <PageHeader title="Billing" description="Your invoices and payments." />
        <EmptyState message="Link your child's account from Home to see invoices here." />
      </div>
    );
  }

  const studentIds = students.map((s) => s.id);
  const studentNames = new Map(students.map((s) => [s.id, s.name]));

  const [{ data: invoices }, { data: packages }] = await Promise.all([
    supabase.from("invoices").select("*").in("client_id", studentIds).order("period_start", { ascending: false }),
    supabase.from("packages").select("*").in("client_id", studentIds).eq("status", "active").order("created_at"),
  ]);

  return (
    <div>
      <PageHeader title="Billing" description="Your invoices and payments." />

      {packages && packages.length > 0 && (
        <Card className="mb-6">
          <h2 className="mb-2 text-sm font-semibold">Package balance</h2>
          <ul className="space-y-1 text-sm">
            {packages.map((p) => (
              <li key={p.id} className="flex justify-between">
                <span>
                  {studentNames.get(p.client_id) ?? "—"} — {p.name}
                </span>
                <span className="text-text-secondary">
                  {p.remaining_sessions} of {p.total_sessions} left
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!invoices || invoices.length === 0 ? (
        <EmptyState message="No invoices yet. Your tutor will send one after your child's next billing period." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-surface-sunken text-left text-text-secondary">
              <tr>
                <th className="px-5 py-3 font-medium">Student</th>
                <th className="px-5 py-3 font-medium">Period</th>
                <th className="px-5 py-3 text-right font-medium">Total</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-t border-border">
                  <td className="px-5 py-3">
                    <Link href={`/parent/billing/${inv.id}`} className="font-medium hover:underline">
                      {studentNames.get(inv.client_id) ?? "—"}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-text-secondary">
                    {formatDate(inv.period_start)} – {formatDate(inv.period_end)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">{formatCents(inv.total_cents)}</td>
                  <td className="px-5 py-3">
                    <StatusDot status={inv.status as StatusKind} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
