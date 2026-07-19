import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireParent } from "@/lib/auth/parent";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { formatCents } from "@/lib/money";
import { formatDate, formatTimestampDate } from "@/lib/date";

export default async function ParentInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireParent();
  const supabase = await createClient();

  // RLS (invoices_select_parent) already scopes this to the signed-in
  // parent's own linked children and excludes drafts — no extra ownership
  // check needed here, same as the rest of the parent shell's detail pages.
  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, clients(student_name)")
    .eq("id", id)
    .maybeSingle();

  if (!invoice) notFound();

  const { data: lineItems } = await supabase
    .from("invoice_line_items")
    .select("*")
    .eq("invoice_id", id)
    .order("created_at");

  const client = invoice.clients as unknown as { student_name: string } | null;
  const isPayable = invoice.status === "sent" || invoice.status === "overdue";

  return (
    <div>
      <PageHeader
        title={client?.student_name ?? "Invoice"}
        description={`${formatDate(invoice.period_start)} – ${formatDate(invoice.period_end)}`}
        action={<StatusDot status={invoice.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-surface-sunken text-left text-text-secondary">
              <tr>
                <th className="px-5 py-3 font-medium">Description</th>
                <th className="px-5 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems?.map((li) => (
                <tr key={li.id} className="border-t border-border">
                  <td className="px-5 py-3">{li.description}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{formatCents(li.amount_cents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border-strong font-medium">
                <td className="px-5 py-3">Total</td>
                <td className="px-5 py-3 text-right tabular-nums">{formatCents(invoice.total_cents)}</td>
              </tr>
            </tfoot>
          </table>
        </Card>

        <div className="space-y-4">
          <Card className="space-y-3">
            {isPayable && invoice.due_date && (
              <p className="text-sm text-text-secondary">
                {invoice.status === "overdue" ? "Was due" : "Due"} {formatDate(invoice.due_date)}.
              </p>
            )}
            {invoice.status === "paid" && (
              <p className="text-sm text-text-secondary">
                Paid{invoice.paid_at ? ` on ${formatTimestampDate(invoice.paid_at)}` : ""}
                {invoice.paid_method ? ` · ${invoice.paid_method}` : ""}.
              </p>
            )}
            {invoice.status === "void" && <p className="text-sm text-text-secondary">This invoice was voided.</p>}
            {isPayable && invoice.stripe_payment_url && (
              <a
                href={invoice.stripe_payment_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-lg bg-text px-4 py-2 text-center text-sm font-medium text-surface hover:opacity-90"
              >
                Pay now ↗
              </a>
            )}
            {isPayable && !invoice.stripe_payment_url && (
              <p className="text-sm text-text-secondary">
                No payment link yet — ask your tutor to send one, or arrange payment directly with them.
              </p>
            )}
            <a
              href={`/invoice/${invoice.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-text underline underline-offset-2"
            >
              Download PDF ↗
            </a>
          </Card>
          <Link href="/parent/billing" className="text-xs text-text-tertiary hover:text-text">
            ← Back to Billing
          </Link>
        </div>
      </div>
    </div>
  );
}
