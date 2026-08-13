import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InvoiceDocument, type InvoiceDocumentData } from "@/components/invoice-document/invoice-document";

// Standalone route (no /tutor or /parent shell) so the same authorized
// visitor — tutor or linked parent, get_invoice_document does its own
// check since RLS alone can't grant a parent's client the tutor's own
// branding info — gets a clean, chrome-free document to print or save as
// PDF, not the dashboard's sidebar/nav (see the migration's own comment
// for why a plain client-side select can't do this for the parent case).
//
// This route is SESSION-authorized. The token-authorized twin at
// app/i/[token] renders the same document for someone following a link from
// an email or a text without an account — see SMS1's migration comment.
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
  const doc = data as unknown as InvoiceDocumentData;

  if (!doc?.found || !doc.invoice || !doc.tutor || !doc.client) notFound();

  return (
    <InvoiceDocument
      invoice={doc.invoice}
      tutor={doc.tutor}
      client={doc.client}
      lineItems={doc.line_items ?? []}
    />
  );
}
