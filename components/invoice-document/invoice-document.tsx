import Image from "next/image";
import { formatCents } from "@/lib/money";
import { formatDate, formatTimestampDate } from "@/lib/date";
import { STATUS_LABELS, type StatusKind } from "@/components/ui/status-dot";
import { PrintButton } from "@/components/invoice-document/print-button";

export interface InvoiceLineItem {
  description: string;
  amount_cents: number;
  line_type: string;
}

/** Shape returned by get_invoice_document(uuid) and get_invoice_document_by_token(text) alike. */
export interface InvoiceDocumentData {
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
    stripe_payment_url?: string | null;
  };
  tutor?: { name: string; email: string; phone: string | null };
  client?: { student_name: string; payer_name: string | null; payer_email: string | null };
  line_items?: InvoiceLineItem[];
}

/**
 * The printable invoice document itself, extracted from app/invoice/[id] so
 * the session-authorized route and the token-authorized /i/[token] route
 * render the identical artifact. Two copies of this markup would drift, and
 * the copy a parent sees from a texted link is exactly the one that must not
 * be the stale one.
 *
 * Renders as fixed white "paper" regardless of the visitor's theme — see the
 * mark below.
 */
export function InvoiceDocument({
  invoice,
  tutor,
  client,
  lineItems,
}: {
  invoice: NonNullable<InvoiceDocumentData["invoice"]>;
  tutor: NonNullable<InvoiceDocumentData["tutor"]>;
  client: NonNullable<InvoiceDocumentData["client"]>;
  lineItems: InvoiceLineItem[];
}) {
  const hasCredit = invoice.subtotal_cents !== invoice.total_cents;
  const isPayable = invoice.status === "sent" || invoice.status === "overdue";

  return (
    <div className="min-h-full bg-white text-[#161616]">
      <div className="mx-auto max-w-2xl px-6 py-10 print:max-w-none print:px-0 print:py-0">
        <div className="mb-8 flex items-center justify-between gap-3 print:hidden">
          <PrintButton />
          {/* The destination of every texted and emailed payment link. Without
              it /i/<token> is a dead end: the parent taps "Pay:" in a text,
              reads their invoice, and has nothing to press. Only rendered
              while the invoice is payable and Stripe is actually connected —
              the SQL nulls the URL out for paid and voided invoices. */}
          {isPayable && invoice.stripe_payment_url && (
            <a
              href={invoice.stripe_payment_url}
              className="inline-flex items-center justify-center rounded-lg bg-[#5f728c] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 motion-safe:active:scale-[0.97]"
            >
              Pay {formatCents(invoice.total_cents)}
            </a>
          )}
        </div>

        <div className="flex items-start justify-between border-b border-[#e5e5e5] pb-6">
          <div>
            {/* Always the on-light mark, not the theme-switching <Mark> component —
                this page renders as a fixed white "paper" document regardless of
                the viewer's site-wide dark/light preference, so the on-dark
                (white-ink) mark would be invisible here if theme-driven. */}
            <Image
              src="/brand/logo/slate-mark-on-light.svg"
              alt="Slate"
              width={546}
              height={768}
              className="mb-4 h-6 w-auto"
            />
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
