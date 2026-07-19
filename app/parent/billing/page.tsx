import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireParent } from "@/lib/auth/parent";
import { getLinkedStudents } from "@/lib/auth/linked-students";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { StatusDot, type StatusKind } from "@/components/ui/status-dot";
import { StatusFilterTabs } from "@/components/ui/status-filter-tabs";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/date";

// Drafts are excluded at the RLS layer (invoices_select_parent), so unlike
// the tutor's equivalent tab list there's no "draft" tab here — a parent
// only ever sees invoices that were actually sent.
const TABS = ["all", "sent", "overdue", "paid", "void"] as const;

export default async function ParentBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = (TABS as readonly string[]).includes(status ?? "") ? (status as (typeof TABS)[number]) : "all";

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

  let query = supabase
    .from("invoices")
    .select("*")
    .in("client_id", studentIds)
    .order("period_start", { ascending: false });
  if (filter !== "all") query = query.eq("status", filter);

  const [{ data: invoices }, { data: packages }] = await Promise.all([
    query,
    supabase.from("packages").select("*").in("client_id", studentIds).eq("status", "active").order("created_at"),
  ]);

  return (
    <div>
      <PageHeader title="Billing" description="Every invoice for your children — all statuses, all children." />

      {packages && packages.length > 0 && (
        <Card className="mb-6">
          <h2 className="mb-2 text-sm font-semibold">Package balance</h2>
          <ul className="space-y-1 text-sm">
            {packages.map((p) => (
              <li key={p.id} className="flex justify-between">
                <span>
                  {studentNames.get(p.client_id ?? "") ?? "—"} — {p.name}
                </span>
                <span className="text-text-secondary">
                  {p.remaining_sessions} of {p.total_sessions} left
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <StatusFilterTabs tabs={TABS} current={filter} basePath="/parent/billing" />

      {!invoices || invoices.length === 0 ? (
        <EmptyState
          message={
            filter === "all"
              ? "No invoices yet. Your tutor will send one after your child's next billing period."
              : `No ${filter} invoices.`
          }
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="rtable w-full text-sm">
            <thead className="bg-surface-sunken text-left text-text-secondary">
              <tr>
                <th className="px-5 py-3 font-medium">Student</th>
                <th className="px-5 py-3 font-medium">Period</th>
                <th className="px-5 py-3 text-right font-medium">Total</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Due</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-t border-border hover:bg-hover">
                  <td className="px-5 py-3">
                    <Link href={`/parent/billing/${inv.id}`} className="font-medium hover:underline">
                      {studentNames.get(inv.client_id) ?? "—"}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-text-secondary" data-label="Period">
                    {formatDate(inv.period_start)} – {formatDate(inv.period_end)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums" data-label="Total">
                    {formatCents(inv.total_cents)}
                  </td>
                  <td className="px-5 py-3" data-label="Status">
                    <StatusDot status={inv.status as StatusKind} />
                  </td>
                  <td className="px-5 py-3 text-text-secondary" data-label="Due">
                    {inv.due_date ? formatDate(inv.due_date) : "—"}
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
