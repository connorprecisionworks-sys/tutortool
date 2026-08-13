import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkIpRateLimit } from "@/lib/rate-limit";
import { InvoiceDocument, type InvoiceDocumentData } from "@/components/invoice-document/invoice-document";

/**
 * Token-authorized invoice view — the destination of every emailed and
 * texted payment link.
 *
 * Why this exists rather than just linking /invoice/[id]: that route
 * authorizes on session (owning tutor, or a linked parent), so a parent
 * tapping a payment link on their phone while signed out lands on "not
 * found". Requiring an account before someone can look at a bill they've
 * been sent is not a real option, so possession of an unguessable token is
 * the credential instead — the same model as Q2 booking links, and as every
 * other invoicing product.
 *
 * The path is short (`/i/<20 hex>`) because it is quoted inside a 160
 * character SMS segment; a /invoice/<uuid> URL costs 61 characters against
 * that budget and pushes a routine reminder into a second segment, which is
 * double the per-message price.
 *
 * Exposure is bounded in the SQL (see SMS1's migration): drafts are never
 * reachable, the payload is exactly the parent-facing document, and the
 * tutor's phone appears only if they set show_phone.
 */
export default async function ShortInvoiceLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();

  // 80 bits of entropy makes blind guessing hopeless, but the endpoint is
  // still an unauthenticated lookup oracle, so it gets the same IP bucket
  // treatment as the other anonymous routes. Fails closed on an
  // unresolvable IP by checkIpRateLimit's own contract.
  const allowed = await checkIpRateLimit(supabase, "invoice_token", 30, 60);
  if (!allowed) notFound();

  const { data, error } = await supabase.rpc("get_invoice_document_by_token", { p_token: token });
  if (error) {
    // Deliberately does not echo the token — it is a live credential and
    // server logs are not the place for it.
    console.error("get_invoice_document_by_token failed:", error.message);
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
