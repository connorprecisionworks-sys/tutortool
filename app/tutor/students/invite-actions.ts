"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";

export async function revokeInviteAction(studentId: string): Promise<{ error?: string }> {
  await requireTutor();
  const supabase = await createClient();

  const { error } = await supabase.rpc("revoke_invite", { p_student_id: studentId });
  revalidatePath(`/tutor/students/${studentId}`);
  revalidatePath("/tutor/students");
  if (error) return { error: error.message };
  return {};
}

export async function regenerateInviteAction(studentId: string): Promise<{ code?: string; error?: string }> {
  await requireTutor();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("regenerate_invite", { p_student_id: studentId });
  revalidatePath(`/tutor/students/${studentId}`);
  revalidatePath("/tutor/students");
  if (error) return { error: error.message };
  return { code: data as string };
}
