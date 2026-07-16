"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireParent } from "@/lib/auth/parent";
import { getPostHogClient } from "@/lib/posthog-server";

export interface RedeemInviteResult {
  error?: string;
}

export async function redeemInviteAction(
  _prev: RedeemInviteResult,
  formData: FormData
): Promise<RedeemInviteResult> {
  const parent = await requireParent();
  const supabase = await createClient();

  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  if (!code) return { error: "Enter a Student Code." };

  const { error } = await supabase.rpc("redeem_invite", { p_code: code });
  if (error) return { error: error.message };

  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: parent.auth_user_id,
    event: "parent_invite_redeemed",
    properties: {},
  });
  await posthog.flush();

  revalidatePath("/parent");
  return {};
}

export interface RedeemTutorCodeResult {
  error?: string;
}

export async function redeemTutorCodeAction(
  _prev: RedeemTutorCodeResult,
  formData: FormData
): Promise<RedeemTutorCodeResult> {
  const parent = await requireParent();
  const supabase = await createClient();

  const tutorCode = String(formData.get("tutor_code") ?? "").trim();
  const childName = String(formData.get("child_name") ?? "").trim();
  const existingStudentId = String(formData.get("existing_student_id") ?? "").trim();

  if (!tutorCode) return { error: "Missing tutor code." };
  if (!childName && !existingStudentId) return { error: "Enter your child's name, or pick one from the list." };

  // redeem_tutor_code (SECURITY DEFINER) creates the client + Student Code
  // inline when childName is given (mirrors create_student's "never a
  // student without a code" invariant), or links directly to an unclaimed
  // student when existingStudentId is given — exactly one, enforced there.
  const { error } = await supabase.rpc("redeem_tutor_code", {
    p_code: tutorCode,
    p_child_name: (childName || null) as unknown as string,
    p_existing_student_id: (existingStudentId || null) as unknown as string,
  });

  if (error) return { error: error.message };

  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: parent.auth_user_id,
    event: "parent_tutor_code_redeemed",
    properties: { created_new_student: Boolean(childName) },
  });
  await posthog.flush();

  revalidatePath("/parent");
  return {};
}
