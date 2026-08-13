import { publicAppUrl } from "@/lib/app-url";

/**
 * Public invoice link, for emails and texts alike.
 *
 * Uses the short token route rather than /invoice/[id] for two reasons, and
 * the second one matters more than the first:
 *
 *   1. Length. `/i/<20 hex>` is 22 characters against an SMS segment's 160;
 *      `/invoice/<uuid>` is 44. On a reminder that also has to carry a
 *      tutor name, an amount and a due date, that difference decides
 *      whether the message costs one segment or two.
 *   2. Reachability. /invoice/[id] authorizes on session, so it shows "not
 *      found" to a parent who is signed out — which is most parents, most
 *      of the time, on a phone. The token route treats the link itself as
 *      the credential.
 *
 * Returned without a scheme prefix option on purpose: handsets linkify a
 * bare domain, and "https://" is 8 more characters of segment budget.
 */
export function invoiceLink(shortToken: string): string {
  return `${publicAppUrl()}/i/${shortToken}`;
}

/** The same link with the scheme stripped, for quoting inside an SMS body. */
export function invoiceLinkForSms(shortToken: string): string {
  return invoiceLink(shortToken).replace(/^https?:\/\//, "");
}
