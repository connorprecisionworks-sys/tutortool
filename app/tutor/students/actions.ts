"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { dollarsToCents } from "@/lib/money";
import { RATE_TYPES_REQUIRING_CUSTOM_RATE, type RateType } from "@/lib/billing";

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
  await requireTutor();
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
  });

  if (error) return { error: error.message };

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

  const { error } = await supabase
    .from("clients")
    .update({
      student_name: studentName,
      payer_name: String(formData.get("payer_name") ?? "").trim() || null,
      payer_email: String(formData.get("payer_email") ?? "").trim() || null,
      payer_phone: String(formData.get("payer_phone") ?? "").trim() || null,
      rate_type: rateType,
      custom_rate_cents: rateType === "standard" || rateType === "pro_bono" ? null : customRateCents,
      bill_travel: parseTriState(formData.get("bill_travel")),
      travel_rate_cents: parseOptionalCents(formData.get("travel_rate_cents")),
      is_philanthropic: formData.get("is_philanthropic") === "on",
      scheduling_mode: parseSchedulingMode(formData.get("scheduling_mode")),
      notes: String(formData.get("notes") ?? "").trim() || null,
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
