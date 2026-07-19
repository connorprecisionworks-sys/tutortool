"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { dollarsToCents } from "@/lib/money";
import { SESSION_REMINDER_MAX_LEAD_HOURS } from "@/lib/reminders";
import { isSmsConfigured } from "@/lib/sms";

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
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 30) || null;

  if (!name) return { error: "Name is required." };

  // "Show my phone number" (Settings > Public page) is consent for one
  // specific number, not a standing publish-anything toggle — mirrors the
  // same reasoning already applied to a client's payer_phone/sms_opt_in in
  // app/tutor/students/actions.ts. Without this, a tutor who once opted a
  // number in, later cleared it, then entered a brand-new personal number
  // here would have that new number silently published on their public
  // page the moment this save lands, with no re-confirmation anywhere.
  const phoneChanged = phone !== tutor.phone;

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
  const sessionReminderLeadHours = Number(formData.get("session_reminder_lead_hours") ?? "24");
  if (
    Number.isNaN(sessionReminderLeadHours) ||
    sessionReminderLeadHours < 0 ||
    sessionReminderLeadHours > SESSION_REMINDER_MAX_LEAD_HOURS
  ) {
    return { error: `Session reminder lead time must be between 0 and ${SESSION_REMINDER_MAX_LEAD_HOURS} hours.` };
  }

  const mileageRate = Number(formData.get("mileage_rate_cents") ?? "0");
  if (Number.isNaN(mileageRate) || mileageRate < 0) {
    return { error: "Mileage rate must be a positive number." };
  }

  // Ignored (stays false) unless Twilio is actually configured platform-
  // wide — the form field is hidden in that case anyway, but re-checked
  // here rather than trusting the client not to submit it regardless.
  const smsEnabled = isSmsConfigured() && formData.get("sms_enabled") === "on";

  const { error } = await supabase
    .from("tutors")
    .update({
      name,
      phone,
      ...(phoneChanged ? { show_phone: false } : {}),
      standard_rate_cents: dollarsToCents(standardRate),
      travel_rate_cents: travelRateRaw ? dollarsToCents(Number(travelRateRaw)) : null,
      bill_travel_default: billTravelDefault,
      invoice_terms: invoiceTerms,
      default_cancellation_policy: cancellationPolicy,
      cancellation_window_hours: Math.round(cancellationWindowHours),
      default_payment_timing: paymentTiming,
      session_reminder_lead_hours: Math.round(sessionReminderLeadHours),
      sms_enabled: smsEnabled,
      mileage_rate_cents: dollarsToCents(mileageRate),
    })
    .eq("id", tutor.id);

  if (error) return { error: error.message };

  revalidatePath("/tutor/settings");
  return { success: true };
}

export interface RegenerateIcalTokenResult {
  error?: string;
  token?: string;
}

export async function regenerateIcalTokenAction(): Promise<RegenerateIcalTokenResult> {
  await requireTutor();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("regenerate_ical_token");

  revalidatePath("/tutor/settings");
  if (error) return { error: error.message };
  return { token: data ?? undefined };
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
    booking_confirmation: {
      subject: String(formData.get("booking_confirmation_subject") ?? "").trim(),
      body: String(formData.get("booking_confirmation_body") ?? "").trim(),
    },
    session_reminder: {
      subject: String(formData.get("session_reminder_subject") ?? "").trim(),
      body: String(formData.get("session_reminder_body") ?? "").trim(),
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
