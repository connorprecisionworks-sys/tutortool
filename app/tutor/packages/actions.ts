"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { dollarsToCents } from "@/lib/money";

export interface PackageFormResult {
  error?: string;
  invoiceId?: string;
}

export async function createPackageAction(
  _prev: PackageFormResult,
  formData: FormData
): Promise<PackageFormResult> {
  await requireTutor();
  const supabase = await createClient();

  const clientId = String(formData.get("client_id") ?? "").trim();
  const serviceId = String(formData.get("service_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const totalSessions = Number(formData.get("total_sessions") ?? "0");
  const priceDollars = Number(formData.get("price_cents") ?? "0");

  if (!clientId) return { error: "Pick a student." };
  if (!name) return { error: "Package name is required." };
  if (!totalSessions || totalSessions <= 0) return { error: "Total sessions must be at least 1." };
  if (Number.isNaN(priceDollars) || priceDollars < 0) return { error: "Price must be a positive number." };

  // create_package (SECURITY DEFINER) creates the package row (unpaid,
  // zero balance) and a draft invoice for the prepayment in one
  // transaction, returning that invoice's id directly — sending it reuses
  // the entire existing Stripe/reminder pipeline; the package activates
  // when it's paid.
  const { data: invoiceId, error } = await supabase.rpc("create_package", {
    p_client_id: clientId,
    p_service_id: (serviceId || null) as unknown as string,
    p_name: name,
    p_total_sessions: Math.round(totalSessions),
    p_price_cents: dollarsToCents(priceDollars),
  });

  if (error) return { error: error.message };
  if (!invoiceId) return { error: "Could not create the package." };

  revalidatePath("/tutor/packages");
  revalidatePath(`/tutor/students/${clientId}`);
  return { invoiceId };
}
