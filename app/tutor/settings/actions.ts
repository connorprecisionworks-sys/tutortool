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

  const cancellationPolicy = String(formData.get("default_cancellation_policy") ?? "rollover");
  if (!["rollover", "refund", "charge"].includes(cancellationPolicy)) {
    return { error: "Invalid cancellation policy." };
  }
  const cancellationWindowHours = Number(formData.get("cancellation_window_hours") ?? "24");
  if (Number.isNaN(cancellationWindowHours) || cancellationWindowHours < 0) {
    return { error: "Cancellation window must be a positive number of hours." };
  }
  const paymentTiming = String(formData.get("default_payment_timing") ?? "pay_after");
  if (!["pay_before", "pay_after"].includes(paymentTiming)) {
    return { error: "Invalid payment timing." };
  }

  const { error } = await supabase
    .from("tutors")
    .update({
      name,
      standard_rate_cents: dollarsToCents(standardRate),
      travel_rate_cents: travelRateRaw ? dollarsToCents(Number(travelRateRaw)) : null,
      bill_travel_default: billTravelDefault,
      invoice_terms: invoiceTerms,
      default_cancellation_policy: cancellationPolicy,
      cancellation_window_hours: Math.round(cancellationWindowHours),
      default_payment_timing: paymentTiming,
    })
    .eq("id", tutor.id);

  if (error) return { error: error.message };

  revalidatePath("/tutor/settings");
  return { success: true };
}

export async function updateReminderTemplatesAction(
  _prev: SettingsFormResult,
  formData: FormData
): Promise<SettingsFormResult> {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const templates = {
    offset_0: {
      subject: String(formData.get("offset_0_subject") ?? "").trim(),
      body: String(formData.get("offset_0_body") ?? "").trim(),
    },
    offset_3: {
      subject: String(formData.get("offset_3_subject") ?? "").trim(),
      body: String(formData.get("offset_3_body") ?? "").trim(),
    },
    offset_7: {
      subject: String(formData.get("offset_7_subject") ?? "").trim(),
      body: String(formData.get("offset_7_body") ?? "").trim(),
    },
  };

  for (const t of Object.values(templates)) {
    if (!t.subject || !t.body) return { error: "Every template needs a subject and a body." };
  }

  const { error } = await supabase
    .from("tutors")
    .update({ reminder_templates: templates })
    .eq("id", tutor.id);

  if (error) return { error: error.message };

  revalidatePath("/tutor/settings");
  return { success: true };
}
