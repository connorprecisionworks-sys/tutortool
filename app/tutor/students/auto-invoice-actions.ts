"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { AUTO_INVOICE_WEEKLY_CADENCE_DAYS } from "@/lib/auto-invoice";

export interface AutoInvoiceFormResult {
  error?: string;
}

type AutoInvoiceTrigger = "weekly" | "after_session" | "package_depleted";

function parseTrigger(value: FormDataEntryValue | null): AutoInvoiceTrigger {
  const v = String(value ?? "weekly");
  return v === "after_session" || v === "package_depleted" ? v : "weekly";
}

function addDaysUtc(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function updateAutoInvoiceSettingsAction(
  _prev: AutoInvoiceFormResult,
  formData: FormData
): Promise<AutoInvoiceFormResult> {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const clientId = String(formData.get("client_id") ?? "");
  const enabled = formData.get("auto_invoice_enabled") === "on";
  const trigger = parseTrigger(formData.get("auto_invoice_trigger"));

  if (!clientId) return { error: "Student not found." };

  const { data: existing } = await supabase
    .from("clients")
    .select("auto_invoice_enabled, auto_invoice_trigger")
    .eq("id", clientId)
    .eq("tutor_id", tutor.id)
    .maybeSingle();

  if (!existing) return { error: "Student not found." };

  // A weekly cadence always starts one cycle out, never immediately on
  // save — only reset the schedule when weekly mode is freshly (re)enabled
  // or newly selected, not on every unrelated save while it's already
  // running, or every edit would keep pushing the next invoice back out.
  const shouldResetNextDate =
    trigger === "weekly" && (!existing.auto_invoice_enabled || existing.auto_invoice_trigger !== "weekly");

  const { error } = await supabase
    .from("clients")
    .update({
      auto_invoice_enabled: enabled,
      auto_invoice_trigger: trigger,
      ...(shouldResetNextDate ? { auto_invoice_next_date: addDaysUtc(AUTO_INVOICE_WEEKLY_CADENCE_DAYS) } : {}),
    })
    .eq("id", clientId)
    .eq("tutor_id", tutor.id);

  if (error) return { error: error.message };

  revalidatePath(`/tutor/students/${clientId}`);
  return {};
}
