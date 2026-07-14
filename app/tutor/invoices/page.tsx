import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { formatCents } from "@/lib/money";
import { DeleteInvoiceRowButton } from "@/components/invoices/delete-invoice-row-button";

const TABS = ["all", "draft", "sent", "overdue", "paid", "void"] as const;

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = (TABS as readonly string[]).includes(status ?? "") ? (status as (typeof TABS)[number]) : "all";

  const tutor = await requireTutor();
  const supabase = await createClient();

  let query = supabase
    .from("invoices")
    .select("*, clients(student_name)")
    .eq("tutor_id", tutor.id)
    .order("created_at", { ascending: false });

  if (filter !== "all") query = query.eq("status", filter);

  const { data: invoices } = await query;

  const { data: hasUnbilled } = await supabase
    .from("sessions")
    .select("id")
    .eq("tutor_id", tutor.id)
    .eq("status", "logged")
    .is("invoice_id", null)
    .limit(1);

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Draft, sent, paid, and overdue invoices."
        action={
          <Link href="/tutor/invoices/new">
            <Button>New invoice</Button>
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-x-3 gap-y-1 text-sm">
        {TABS.map((t) => (
          <Link
            key={t}
            href={t === "all" ? "/tutor/invoices" : `/tutor/invoices?status=${t}`}
            className={filter === t ? "font-medium text-text" : "text-text-secondary hover:text-text"}
          >
            {t === "all" ? "All" : t[0].toUpperCase() + t.slice(1)}
          </Link>
        ))}
      </div>

      {!invoices || invoices.length === 0 ? (
        <EmptyState
          message={
            hasUnbilled && hasUnbilled.length > 0
              ? "No invoices yet. You have unbilled sessions ready to bundle."
              : "No invoices yet. Log a few sessions, then bundle them into your first invoice."
          }
          action={
            <Link href="/tutor/invoices/new">
              <Button>New invoice</Button>
            </Link>
          }
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-surface-sunken text-left text-text-secondary">
              <tr>
                <th className="px-5 py-3 font-medium">Student</th>
                <th className="px-5 py-3 font-medium">Period</th>
                <th className="px-5 py-3 text-right font-medium">Total</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Due</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-t border-border hover:bg-hover">
                  <td className="px-5 py-3">
                    <Link href={`/tutor/invoices/${inv.id}`} className="font-medium">
                      {(inv.clients as unknown as { student_name: string } | null)?.student_name ?? "—"}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-text-secondary">
                    {inv.period_start} – {inv.period_end}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">{formatCents(inv.total_cents)}</td>
                  <td className="px-5 py-3">
                    <StatusDot status={inv.status} />
                  </td>
                  <td className="px-5 py-3 text-text-secondary">{inv.due_date ?? "—"}</td>
                  <td className="px-5 py-3 text-right">
                    {inv.status === "draft" && <DeleteInvoiceRowButton invoiceId={inv.id} />}
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
