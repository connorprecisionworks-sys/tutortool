"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { dollarsToCents } from "@/lib/money";
import { RATE_TYPES_REQUIRING_CUSTOM_RATE, type RateType } from "@/lib/billing";
import { getPostHogClient } from "@/lib/posthog-server";
import { isSmsConfigured } from "@/lib/sms";

export interface StudentFormResult {
  error?: string;
}

function parseRateType(value: FormDataEntryValue | null): RateType {
  const allowed: RateType[] = ["standard", "professional_discount", "friend", "low_income", "pro_bono"];
  const v = String(value ?? "standard");
  return (allowed as string[]).includes(v) ? (v as RateType) : "standard";
}

function parseOptionalCents(value: FormDataEntryValue | null): number | null {
  const v = String(value ?? "").trim();
  if (!v) return null;
  const dollars = Number(v);
  if (Number.isNaN(dollars)) return null;
  return dollarsToCents(dollars);
}

function parseTriState(value: FormDataEntryValue | null): boolean | null {
  const v = String(value ?? "default");
  if (v === "yes") return true;
  if (v === "no") return false;
  return null;
}

function parseSchedulingMode(value: FormDataEntryValue | null): "request" | "calendar" | "message" {
  const v = String(value ?? "message");
  return v === "request" || v === "calendar" ? v : "message";
}

export async function createStudentAction(
  _prev: StudentFormResult,
  formData: FormData
): Promise<StudentFormResult> {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const studentName = String(formData.get("student_name") ?? "").trim();
  if (!studentName) return { error: "Student name is required." };

  const rateType = parseRateType(formData.get("rate_type"));
  const customRateCents = parseOptionalCents(formData.get("custom_rate_cents"));

  if (RATE_TYPES_REQUIRING_CUSTOM_RATE.includes(rateType) && customRateCents === null) {
    return { error: "This rate type needs an hourly rate." };
  }

  // create_student (SECURITY DEFINER) inserts the student and issues its
  // first Student Code in one transaction, so a student can never end up
  // without a code.
  //
  // The generated RPC arg types don't reflect that several of these
  // Postgres params accept null (the type generator only sees the SQL
  // types, not that the function body is fine with a null value) —
  // Postgres itself accepts null here without issue.
  const { error } = await supabase.rpc("create_student", {
    p_student_name: studentName,
    p_payer_name: (String(formData.get("payer_name") ?? "").trim() || null) as unknown as string,
    p_payer_email: (String(formData.get("payer_email") ?? "").trim() || null) as unknown as string,
    p_payer_phone: (String(formData.get("payer_phone") ?? "").trim() || null) as unknown as string,
    p_rate_type: rateType,
    p_custom_rate_cents: (rateType === "standard" || rateType === "pro_bono"
      ? null
      : customRateCents) as unknown as number,
    p_bill_travel: parseTriState(formData.get("bill_travel")) as unknown as boolean,
    p_travel_rate_cents: parseOptionalCents(formData.get("travel_rate_cents")) as unknown as number,
    p_is_philanthropic: formData.get("is_philanthropic") === "on",
    p_scheduling_mode: parseSchedulingMode(formData.get("scheduling_mode")),
    p_notes: (String(formData.get("notes") ?? "").trim() || null) as unknown as string,
    // Re-checked server-side (not just trusting the form field) so SMS
    // can't be opted into via a raw POST while it's platform-wide disabled.
    p_sms_opt_in: isSmsConfigured() && formData.get("sms_opt_in") === "on",
    p_needs_goals: (String(formData.get("needs_goals") ?? "").trim() || null) as unknown as string,
  });

  if (error) return { error: error.message };

  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: tutor.auth_user_id,
    event: "student_added",
    properties: {
      rate_type: rateType,
      is_philanthropic: formData.get("is_philanthropic") === "on",
    },
  });
  await posthog.flush();

  revalidatePath("/tutor/students");
  return {};
}

export async function updateStudentAction(
  _prev: StudentFormResult,
  formData: FormData
): Promise<StudentFormResult> {
  const studentId = String(formData.get("id") ?? "");
  if (!studentId) return { error: "Missing student id." };

  const supabase = await createClient();

  const studentName = String(formData.get("student_name") ?? "").trim();
  if (!studentName) return { error: "Student name is required." };

  const rateType = parseRateType(formData.get("rate_type"));
  const customRateCents = parseOptionalCents(formData.get("custom_rate_cents"));

  if (RATE_TYPES_REQUIRING_CUSTOM_RATE.includes(rateType) && customRateCents === null) {
    return { error: "This rate type needs an hourly rate." };
  }

  const payerPhone = String(formData.get("payer_phone") ?? "").trim() || null;

  // sms_opt_in needs care here: the consent checkbox only renders when SMS
  // is configured, so a plain `formData.get(...) === "on"` would silently
  // wipe previously-granted consent to false on every edit made while SMS
  // happens to be unconfigured (e.g. Twilio keys rotated out temporarily).
  // And consent was only ever given for a specific number, so if the phone
  // number itself changed in this same edit, that consent doesn't carry
  // over to the new number — require it to be re-granted.
  const { data: existing } = await supabase
    .from("clients")
    .select("payer_phone, sms_opt_in")
    .eq("id", studentId)
    .single();

  let smsOptIn = existing?.sms_opt_in ?? false;
  if (isSmsConfigured()) {
    smsOptIn = payerPhone !== (existing?.payer_phone ?? null) ? false : formData.get("sms_opt_in") === "on";
  }

  const { error } = await supabase
    .from("clients")
    .update({
      student_name: studentName,
      payer_name: String(formData.get("payer_name") ?? "").trim() || null,
      payer_email: String(formData.get("payer_email") ?? "").trim() || null,
      payer_phone: payerPhone,
      rate_type: rateType,
      custom_rate_cents: rateType === "standard" || rateType === "pro_bono" ? null : customRateCents,
      bill_travel: parseTriState(formData.get("bill_travel")),
      travel_rate_cents: parseOptionalCents(formData.get("travel_rate_cents")),
      is_philanthropic: formData.get("is_philanthropic") === "on",
      scheduling_mode: parseSchedulingMode(formData.get("scheduling_mode")),
      notes: String(formData.get("notes") ?? "").trim() || null,
      needs_goals: String(formData.get("needs_goals") ?? "").trim() || null,
      sms_opt_in: smsOptIn,
    })
    .eq("id", studentId);

  if (error) return { error: error.message };

  revalidatePath("/tutor/students");
  revalidatePath(`/tutor/students/${studentId}`);
  return {};
}

export async function setStudentArchivedAction(studentId: string, archived: boolean): Promise<void> {
  const supabase = await createClient();
  await supabase.from("clients").update({ archived }).eq("id", studentId);
  revalidatePath("/tutor/students");
}

export interface DeleteStudentResult {
  error?: string;
}

export async function deleteStudentAction(studentId: string): Promise<DeleteStudentResult> {
  await requireTutor();
  const supabase = await createClient();
  // delete_student (SECURITY DEFINER) blocks the delete if this student
  // has any non-draft invoice — real billing history — and directs the
  // tutor to archive instead; otherwise it releases any draft invoices and
  // cascades the rest (sessions, resources, invites, parent links).
  const { error } = await supabase.rpc("delete_student", { p_student_id: studentId });

  revalidatePath("/tutor/students");
  if (error) return { error: error.message };
  return {};
}

export interface PendingStudentResult {
  error?: string;
}

export async function confirmPendingStudentAction(studentId: string): Promise<PendingStudentResult> {
  await requireTutor();
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_pending_student", { p_student_id: studentId });

  revalidatePath("/tutor/students");
  if (error) return { error: error.message };
  return {};
}

export async function mergePendingStudentAction(
  pendingStudentId: string,
  targetStudentId: string
): Promise<PendingStudentResult> {
  await requireTutor();
  const supabase = await createClient();
  // merge_pending_student (SECURITY DEFINER) re-points the parent's link
  // to the target student and discards the parent-created duplicate — only
  // allowed while it's still pending review with no sessions/invoices yet.
  const { error } = await supabase.rpc("merge_pending_student", {
    p_pending_student_id: pendingStudentId,
    p_target_student_id: targetStudentId,
  });

  revalidatePath("/tutor/students");
  if (error) return { error: error.message };
  return {};
}
