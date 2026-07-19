import { notFound } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/money";
import { formatDate, formatTimestampDate } from "@/lib/date";
import { STATUS_LABELS, type StatusKind } from "@/components/ui/status-dot";
import { PrintButton } from "@/components/invoice-document/print-button";

interface InvoiceLineItem {
  description: string;
  amount_cents: number;
  line_type: string;
}

interface InvoiceDocument {
  found: boolean;
  invoice?: {
    id: string;
    period_start: string;
    period_end: string;
    status: string;
    due_date: string | null;
    sent_at: string | null;
    paid_at: string | null;
    paid_method: string | null;
    subtotal_cents: number;
    total_cents: number;
  };
  tutor?: { name: string; email: string; phone: string | null };
  client?: { student_name: string; payer_name: string | null; payer_email: string | null };
  line_items?: InvoiceLineItem[];
}

// Standalone route (no /tutor or /parent shell) so the same authorized
// visitor — tutor or linked parent, get_invoice_document does its own
// check since RLS alone can't grant a parent's client the tutor's own
// branding info — gets a clean, chrome-free document to print or save as
// PDF, not the dashboard's sidebar/nav (see the migration's own comment
// for why a plain client-side select can't do this for the parent case).
export default async function InvoiceDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_invoice_document", { p_invoice_id: id });
  if (error) {
    // Logged, not shown: the visitor still sees the same calm "not found"
    // page (no useful action they could take from a raw DB error), but
    // this line means an infra hiccup here is distinguishable in the
    // server logs from a legitimately unauthorized/missing invoice.
    console.error(`get_invoice_document(${id}) failed:`, error.message);
  }
  const doc = data as unknown as InvoiceDocument;

  if (!doc?.found || !doc.invoice || !doc.tutor || !doc.client) notFound();

  const { invoice, tutor, client, line_items: lineItems = [] } = doc;
  const hasCredit = invoice.subtotal_cents !== invoice.total_cents;
  const isPayable = invoice.status === "sent" || invoice.status === "overdue";

  return (
    <div className="min-h-full bg-white text-[#161616]">
      <div className="mx-auto max-w-2xl px-6 py-10 print:max-w-none print:px-0 print:py-0">
        <div className="mb-8 flex justify-end print:hidden">
          <PrintButton />
        </div>

        <div className="flex items-start justify-between border-b border-[#e5e5e5] pb-6">
          <div>
            {/* Always the on-light mark, not the theme-switching <Mark> component —
                this page renders as a fixed white "paper" document regardless of
                the viewer's site-wide dark/light preference, so the on-dark
                (white-ink) mark would be invisible here if theme-driven. */}
            <Image src="/brand/logo/slate-mark-on-light.svg" alt="Slate" width={546} height={768} className="mb-4 h-6 w-auto" />
            <h1 className="text-2xl font-semibold">Invoice</h1>
            <p className="mt-1 text-sm text-[#6e6e80]">
              {formatDate(invoice.period_start)} – {formatDate(invoice.period_end)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">{STATUS_LABELS[invoice.status as StatusKind] ?? invoice.status}</p>
            {isPayable && invoice.due_date && (
              <p className="mt-1 text-xs text-[#6e6e80]">
                {invoice.status === "overdue" ? "Was due" : "Due"} {formatDate(invoice.due_date)}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 text-sm break-words sm:grid-cols-2 print:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[#8e8ea0]">From</p>
            <p className="font-medium">{tutor.name}</p>
            <p className="text-[#6e6e80]">{tutor.email}</p>
            {tutor.phone && <p className="text-[#6e6e80]">{tutor.phone}</p>}
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[#8e8ea0]">Billed to</p>
            <p className="font-medium">{client.payer_name ?? "—"}</p>
            {client.payer_email && <p className="text-[#6e6e80]">{client.payer_email}</p>}
            <p className="text-[#6e6e80]">For {client.student_name}</p>
          </div>
        </div>

        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b border-[#e5e5e5] text-left text-[#6e6e80]">
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((li, i) => {
              const isCredit = li.line_type === "credit";
              return (
                <tr key={i} className="border-b border-[#f2f2f3]">
                  <td className="py-2.5">{li.description}</td>
                  <td className={`py-2.5 text-right tabular-nums ${isCredit ? "text-[#6e6e80]" : ""}`}>
                    {isCredit ? "−" : ""}
                    {formatCents(li.amount_cents)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            {hasCredit && (
              <tr className="text-[#6e6e80]">
                <td className="pt-3">Subtotal</td>
                <td className="pt-3 text-right tabular-nums">{formatCents(invoice.subtotal_cents)}</td>
              </tr>
            )}
            <tr className="text-base font-semibold">
              <td className="pt-3">Total</td>
              <td className="pt-3 text-right tabular-nums">{formatCents(invoice.total_cents)}</td>
            </tr>
          </tfoot>
        </table>

        {invoice.status === "paid" && invoice.paid_at && (
          <p className="mt-8 text-sm text-[#6e6e80]">
            Paid {formatTimestampDate(invoice.paid_at)}
            {invoice.paid_method ? ` · ${invoice.paid_method}` : ""}.
          </p>
        )}
        {invoice.status === "void" && <p className="mt-8 text-sm text-[#6e6e80]">This invoice was voided.</p>}

        <p className="mt-12 text-center text-xs text-[#8e8ea0]">Slate — Back office for tutors.</p>
      </div>
    </div>
  );
}
