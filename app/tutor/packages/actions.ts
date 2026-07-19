"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { dollarsToCents } from "@/lib/money";

export interface PackageFormResult {
  error?: string;
  invoiceId?: string;
  packageId?: string;
}

export async function createPackageAction(
  _prev: PackageFormResult,
  formData: FormData
): Promise<PackageFormResult> {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const clientId = String(formData.get("client_id") ?? "").trim();
  const serviceId = String(formData.get("service_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const totalSessions = Number(formData.get("total_sessions") ?? "0");
  const customPriceDollars = String(formData.get("custom_price_per_session") ?? "").trim();
  const discountType = String(formData.get("discount_type") ?? "none").trim();
  const discountPercent = Number(formData.get("discount_percent") ?? "0");
  const discountAmountDollars = String(formData.get("discount_amount") ?? "").trim();
  const isPublic = formData.get("is_public") === "on";

  if (!name) return { error: "Package name is required." };
  if (!totalSessions || totalSessions <= 0) return { error: "Total sessions must be at least 1." };
  if (!["none", "percent", "amount"].includes(discountType)) return { error: "Invalid discount type." };
  if (!serviceId) {
    if (!customPriceDollars) return { error: "Price per session is required when no service is selected." };
    const customPriceNumber = Number(customPriceDollars);
    if (Number.isNaN(customPriceNumber) || customPriceNumber < 0) {
      return { error: "Price per session must be a positive number." };
    }
  }

  const { data, error } = await supabase.rpc("create_package", {
    p_client_id: (clientId || null) as unknown as string,
    p_service_id: (serviceId || null) as unknown as string,
    p_name: name,
    p_total_sessions: Math.round(totalSessions),
    p_custom_price_per_session_cents: customPriceDollars
      ? dollarsToCents(Number(customPriceDollars))
      : (null as unknown as number),
    p_discount_type: discountType,
    p_discount_percent: discountType === "percent" ? Math.round(discountPercent) : (null as unknown as number),
    p_discount_amount_cents:
      discountType === "amount" ? dollarsToCents(Number(discountAmountDollars) || 0) : (null as unknown as number),
    p_is_public: clientId ? false : isPublic,
  });

  if (error) return { error: error.message };
  const result = data as unknown as { invoice_id: string | null; package_id: string };
  if (!result?.package_id) return { error: "Could not create the package." };

  revalidatePath("/tutor/packages");
  if (clientId) revalidatePath(`/tutor/students/${clientId}`);
  if (tutor.handle) revalidatePath(`/t/${tutor.handle}`);
  return { invoiceId: result.invoice_id ?? undefined, packageId: result.package_id };
}

export async function setPackagePublicAction(packageId: string, isPublic: boolean): Promise<{ error?: string }> {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const { error } = await supabase.rpc("set_package_public", {
    p_package_id: packageId,
    p_is_public: isPublic,
  });

  if (error) return { error: error.message };

  revalidatePath("/tutor/packages");
  if (tutor.handle) revalidatePath(`/t/${tutor.handle}`);
  return {};
}
