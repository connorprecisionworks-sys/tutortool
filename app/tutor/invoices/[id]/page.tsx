import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { formatCents } from "@/lib/money";
import { AddLineForm } from "@/components/invoices/add-line-form";
import { RemoveLineButton } from "@/components/invoices/remove-line-button";
import { SendInvoiceButton, MarkPaidControl, VoidInvoiceButton } from "@/components/invoices/invoice-actions";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tutor = await requireTutor();
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, clients(student_name, payer_name, payer_email)")
    .eq("id", id)
    .eq("tutor_id", tutor.id)
    .maybeSingle();

  if (!invoice) notFound();

  const { data: lineItems } = await supabase
    .from("invoice_line_items")
    .select("*")
    .eq("invoice_id", id)
    .order("created_at");

  const client = invoice.clients as unknown as {
    student_name: string;
    payer_name: string | null;
    payer_email: string | null;
  } | null;

  const isDraft = invoice.status === "draft";
  const isPayable = invoice.status === "sent" || invoice.status === "overdue";
  const canVoid = invoice.status === "draft" || invoice.status === "sent" || invoice.status === "overdue";

  return (
    <div>
      <PageHeader
        title={client?.student_name ?? "Invoice"}
        description={`${invoice.period_start} – ${invoice.period_end}`}
        action={<StatusDot status={invoice.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-surface-sunken text-left text-text-secondary">
              <tr>
                <th className="px-5 py-3 font-medium">Description</th>
                <th className="px-5 py-3 text-right font-medium">Amount</th>
                {isDraft && <th className="px-5 py-3" />}
              </tr>
            </thead>
            <tbody>
              {lineItems?.map((li) => (
                <tr key={li.id} className="border-t border-border">
                  <td className="px-5 py-3">{li.description}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{formatCents(li.amount_cents)}</td>
                  {isDraft && (
                    <td className="px-5 py-3 text-right">
                      <RemoveLineButton lineItemId={li.id} invoiceId={invoice.id} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border-strong font-medium">
                <td className="px-5 py-3">Total</td>
                <td className="px-5 py-3 text-right tabular-nums">{formatCents(invoice.total_cents)}</td>
                {isDraft && <td />}
              </tr>
            </tfoot>
          </table>
          {isDraft && (
            <div className="px-5 py-4">
              <AddLineForm invoiceId={invoice.id} />
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 text-sm font-semibold">Billed to</h2>
            <p className="text-sm">{client?.payer_name ?? "No payer name on file"}</p>
            <p className="text-sm text-text-secondary">{client?.payer_email ?? "No email on file"}</p>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold">Details</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-secondary">Due</dt>
                <dd>{invoice.due_date ?? "—"}</dd>
              </div>
              {invoice.sent_at && (
                <div className="flex justify-between">
                  <dt className="text-text-secondary">Sent</dt>
                  <dd>{new Date(invoice.sent_at).toLocaleDateString()}</dd>
                </div>
              )}
              {invoice.paid_at && (
                <div className="flex justify-between">
                  <dt className="text-text-secondary">Paid</dt>
                  <dd>
                    {new Date(invoice.paid_at).toLocaleDateString()}
                    {invoice.paid_method ? ` · ${invoice.paid_method}` : ""}
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          <Card className="space-y-3">
            {isDraft && (
              <SendInvoiceButton invoiceId={invoice.id} disabled={!lineItems || lineItems.length === 0} />
            )}
            {invoice.status === "sent" && (
              // TODO(connor): P4 wires a real Stripe payment link here. Until
              // then this is the tutor's cue to collect payment off-platform
              // and mark it paid manually.
              <p className="text-xs text-text-tertiary">
                Stripe payment links land in a later phase. For now, collect payment directly and mark this
                paid below.
              </p>
            )}
            {isPayable && <MarkPaidControl invoiceId={invoice.id} />}
            {canVoid && <VoidInvoiceButton invoiceId={invoice.id} />}
            {invoice.status === "paid" && <p className="text-sm text-text-secondary">Paid in full.</p>}
            {invoice.status === "void" && <p className="text-sm text-text-secondary">This invoice was voided.</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
