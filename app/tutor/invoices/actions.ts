"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { dollarsToCents } from "@/lib/money";

export interface InvoiceFormResult {
  error?: string;
  invoiceId?: string;
}

export async function createDraftInvoiceAction(
  _prev: InvoiceFormResult,
  formData: FormData
): Promise<InvoiceFormResult> {
  await requireTutor();
  const supabase = await createClient();

  const clientId = String(formData.get("client_id") ?? "");
  const periodStart = String(formData.get("period_start") ?? "");
  const periodEnd = String(formData.get("period_end") ?? "");

  if (!clientId) return { error: "Pick a student." };
  if (!periodStart || !periodEnd) return { error: "Pick a date range." };
  if (periodStart > periodEnd) return { error: "Start date must be before end date." };

  const { data, error } = await supabase.rpc("create_draft_invoice", {
    p_client_id: clientId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
  });

  if (error) return { error: error.message };

  revalidatePath("/tutor/invoices");
  return { invoiceId: data as string };
}

export async function addManualLineAction(
  _prev: InvoiceFormResult,
  formData: FormData
): Promise<InvoiceFormResult> {
  await requireTutor();
  const supabase = await createClient();

  const invoiceId = String(formData.get("invoice_id") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const amountDollars = Number(formData.get("amount") ?? "0");

  if (!description) return { error: "Description is required." };
  if (!amountDollars || Number.isNaN(amountDollars) || amountDollars <= 0) {
    return { error: "Enter an amount greater than zero." };
  }

  const { error } = await supabase.rpc("add_manual_line_item", {
    p_invoice_id: invoiceId,
    p_description: description,
    p_amount_cents: dollarsToCents(amountDollars),
  });

  if (error) return { error: error.message };

  revalidatePath(`/tutor/invoices/${invoiceId}`);
  return {};
}

export async function removeLineItemAction(
  lineItemId: string,
  invoiceId: string
): Promise<{ error?: string }> {
  await requireTutor();
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_line_item", { p_line_item_id: lineItemId });
  revalidatePath(`/tutor/invoices/${invoiceId}`);
  if (error) return { error: error.message };
  return {};
}

export async function sendInvoiceAction(invoiceId: string): Promise<{ error?: string }> {
  await requireTutor();
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_invoice", { p_invoice_id: invoiceId });
  revalidatePath(`/tutor/invoices/${invoiceId}`);
  revalidatePath("/tutor/invoices");
  revalidatePath("/tutor/sessions");
  if (error) return { error: error.message };
  return {};
}

export async function markInvoicePaidAction(invoiceId: string, method: string): Promise<{ error?: string }> {
  await requireTutor();
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_invoice_paid", { p_invoice_id: invoiceId, p_method: method });
  revalidatePath(`/tutor/invoices/${invoiceId}`);
  revalidatePath("/tutor/invoices");
  if (error) return { error: error.message };
  return {};
}

export async function voidInvoiceAction(invoiceId: string): Promise<{ error?: string }> {
  await requireTutor();
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_invoice", { p_invoice_id: invoiceId });
  revalidatePath(`/tutor/invoices/${invoiceId}`);
  revalidatePath("/tutor/invoices");
  revalidatePath("/tutor/sessions");
  if (error) return { error: error.message };
  return {};
}
