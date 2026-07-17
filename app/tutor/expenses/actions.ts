"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTutor } from "@/lib/auth/tutor";
import { dollarsToCents } from "@/lib/money";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/expenses";

export interface ExpenseFormResult {
  error?: string;
}

function parseCategory(value: FormDataEntryValue | null): ExpenseCategory | null {
  const v = String(value ?? "");
  return (EXPENSE_CATEGORIES as readonly string[]).includes(v) ? (v as ExpenseCategory) : null;
}

async function uploadReceipt(
  tutorId: string,
  file: File
): Promise<{ path?: string; error?: string }> {
  if (file.size === 0) return {};
  if (file.size > 10 * 1024 * 1024) return { error: "Receipts must be under 10 MB." };

  const path = `${tutorId}/${randomUUID()}-${file.name}`;
  const admin = createAdminClient();
  const { error } = await admin.storage.from("receipts").upload(path, file, {
    contentType: file.type || undefined,
  });
  if (error) return { error: error.message };
  return { path };
}

export async function createExpenseAction(
  _prev: ExpenseFormResult,
  formData: FormData
): Promise<ExpenseFormResult> {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const category = parseCategory(formData.get("category"));
  if (!category) return { error: "Pick a category." };

  const incurredOn = String(formData.get("incurred_on") ?? "");
  if (!incurredOn) return { error: "Enter a date." };

  const vendor = String(formData.get("vendor") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;
  const studentId = String(formData.get("student_id") ?? "").trim() || null;
  const sessionId = String(formData.get("session_id") ?? "").trim() || null;

  let amountCents: number;
  let miles: number | null = null;
  let mileageRateCents: number | null = null;
  let fromLocation: string | null = null;
  let toLocation: string | null = null;

  if (category === "mileage") {
    const milesRaw = Number(formData.get("miles") ?? "0");
    if (!milesRaw || Number.isNaN(milesRaw) || milesRaw <= 0) {
      return { error: "Enter the number of miles driven." };
    }
    miles = Math.round(milesRaw * 100) / 100;
    mileageRateCents = tutor.mileage_rate_cents;
    // Computed server-side from the tutor's current rate, never trusted
    // from the client — this is what makes "miles times the set rate"
    // an actual invariant instead of a client-suggested number.
    amountCents = Math.round(miles * mileageRateCents);
    fromLocation = String(formData.get("from_location") ?? "").trim() || null;
    toLocation = String(formData.get("to_location") ?? "").trim() || null;
  } else {
    const dollars = Number(formData.get("amount") ?? "0");
    if (!dollars || Number.isNaN(dollars) || dollars <= 0) {
      return { error: "Enter an amount greater than zero." };
    }
    amountCents = dollarsToCents(dollars);
  }

  let receiptPath: string | null = null;
  const receiptFile = formData.get("receipt");
  if (receiptFile instanceof File && receiptFile.size > 0) {
    const result = await uploadReceipt(tutor.id, receiptFile);
    if (result.error) return { error: result.error };
    receiptPath = result.path ?? null;
  }

  const { error } = await supabase.from("expenses").insert({
    tutor_id: tutor.id,
    incurred_on: incurredOn,
    category,
    amount_cents: amountCents,
    vendor,
    note,
    receipt_path: receiptPath,
    student_id: studentId,
    session_id: sessionId,
    miles,
    mileage_rate_cents: mileageRateCents,
    from_location: fromLocation,
    to_location: toLocation,
  });

  if (error) {
    // Row insert failed after a successful upload — clean up the orphaned
    // storage object rather than leaking it (mirrors the resources action).
    if (receiptPath) {
      const admin = createAdminClient();
      await admin.storage.from("receipts").remove([receiptPath]);
    }
    return { error: error.message };
  }

  revalidatePath("/tutor/expenses");
  revalidatePath("/tutor");
  return {};
}

export async function updateExpenseAction(
  _prev: ExpenseFormResult,
  formData: FormData
): Promise<ExpenseFormResult> {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const expenseId = String(formData.get("id") ?? "");
  if (!expenseId) return { error: "Missing expense id." };

  const { data: existing } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", expenseId)
    .eq("tutor_id", tutor.id)
    .maybeSingle();
  if (!existing) return { error: "Expense not found." };

  const category = parseCategory(formData.get("category"));
  if (!category) return { error: "Pick a category." };

  const incurredOn = String(formData.get("incurred_on") ?? "");
  if (!incurredOn) return { error: "Enter a date." };

  const vendor = String(formData.get("vendor") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;
  const studentId = String(formData.get("student_id") ?? "").trim() || null;
  const sessionId = String(formData.get("session_id") ?? "").trim() || null;

  let amountCents: number;
  let miles: number | null = null;
  let mileageRateCents: number | null = existing.mileage_rate_cents;
  let fromLocation: string | null = null;
  let toLocation: string | null = null;

  if (category === "mileage") {
    const milesRaw = Number(formData.get("miles") ?? "0");
    if (!milesRaw || Number.isNaN(milesRaw) || milesRaw <= 0) {
      return { error: "Enter the number of miles driven." };
    }
    miles = Math.round(milesRaw * 100) / 100;
    // Re-snapshot at the current rate on edit, same as creating fresh —
    // an edited trip should reflect today's rate setting, not silently
    // keep stale editor-invisible state from before the edit.
    mileageRateCents = tutor.mileage_rate_cents;
    amountCents = Math.round(miles * mileageRateCents);
    fromLocation = String(formData.get("from_location") ?? "").trim() || null;
    toLocation = String(formData.get("to_location") ?? "").trim() || null;
  } else {
    const dollars = Number(formData.get("amount") ?? "0");
    if (!dollars || Number.isNaN(dollars) || dollars <= 0) {
      return { error: "Enter an amount greater than zero." };
    }
    amountCents = dollarsToCents(dollars);
    mileageRateCents = null;
  }

  let receiptPath = existing.receipt_path;
  const receiptFile = formData.get("receipt");
  if (receiptFile instanceof File && receiptFile.size > 0) {
    const result = await uploadReceipt(tutor.id, receiptFile);
    if (result.error) return { error: result.error };
    if (result.path) {
      if (existing.receipt_path) {
        const admin = createAdminClient();
        await admin.storage.from("receipts").remove([existing.receipt_path]);
      }
      receiptPath = result.path;
    }
  }

  const { error } = await supabase
    .from("expenses")
    .update({
      incurred_on: incurredOn,
      category,
      amount_cents: amountCents,
      vendor,
      note,
      receipt_path: receiptPath,
      student_id: studentId,
      session_id: sessionId,
      miles,
      mileage_rate_cents: mileageRateCents,
      from_location: fromLocation,
      to_location: toLocation,
    })
    .eq("id", expenseId);

  if (error) return { error: error.message };

  revalidatePath("/tutor/expenses");
  revalidatePath("/tutor");
  return {};
}

export async function deleteExpenseAction(expenseId: string): Promise<{ error?: string }> {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const { data: expense } = await supabase
    .from("expenses")
    .select("receipt_path")
    .eq("id", expenseId)
    .eq("tutor_id", tutor.id)
    .maybeSingle();

  if (!expense) return { error: "Expense not found." };

  if (expense.receipt_path) {
    const admin = createAdminClient();
    const { error: storageError } = await admin.storage.from("receipts").remove([expense.receipt_path]);
    if (storageError) {
      console.error(`Failed to remove receipt for expense ${expenseId}:`, storageError.message);
      return { error: "Could not remove the receipt. Try again." };
    }
  }

  const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
  if (error) return { error: error.message };

  revalidatePath("/tutor/expenses");
  revalidatePath("/tutor");
  return {};
}

/** Signed URL for viewing a private receipt — short-lived, generated on demand server-side. */
export async function getReceiptUrlAction(expenseId: string): Promise<{ url?: string; error?: string }> {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const { data: expense } = await supabase
    .from("expenses")
    .select("receipt_path")
    .eq("id", expenseId)
    .eq("tutor_id", tutor.id)
    .maybeSingle();

  if (!expense?.receipt_path) return { error: "No receipt on this expense." };

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("receipts").createSignedUrl(expense.receipt_path, 60);
  if (error || !data) return { error: error?.message ?? "Could not open the receipt." };

  return { url: data.signedUrl };
}
