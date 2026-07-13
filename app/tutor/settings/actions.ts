"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { dollarsToCents } from "@/lib/money";

export interface SettingsFormResult {
  error?: string;
  success?: boolean;
}

export async function updateTutorSettingsAction(
  _prev: SettingsFormResult,
  formData: FormData
): Promise<SettingsFormResult> {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const standardRate = Number(formData.get("standard_rate_cents") ?? "0");
  if (Number.isNaN(standardRate) || standardRate < 0) {
    return { error: "Standard rate must be a positive number." };
  }

  const travelRateRaw = String(formData.get("travel_rate_cents") ?? "").trim();
  const invoiceTerms = String(formData.get("invoice_terms") ?? "due_on_receipt");
  const billTravelDefault = formData.get("bill_travel_default") === "on";
  const name = String(formData.get("name") ?? "").trim();

  if (!name) return { error: "Name is required." };

  const { error } = await supabase
    .from("tutors")
    .update({
      name,
      standard_rate_cents: dollarsToCents(standardRate),
      travel_rate_cents: travelRateRaw ? dollarsToCents(Number(travelRateRaw)) : null,
      bill_travel_default: billTravelDefault,
      invoice_terms: invoiceTerms,
    })
    .eq("id", tutor.id);

  if (error) return { error: error.message };

  revalidatePath("/tutor/settings");
  return { success: true };
}
