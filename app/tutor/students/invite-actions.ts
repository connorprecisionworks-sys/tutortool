"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";

export async function createInviteAction(studentId: string): Promise<{ code?: string; error?: string }> {
  await requireTutor();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_invite", { p_student_id: studentId });
  if (error) return { error: error.message };

  revalidatePath(`/tutor/students/${studentId}`);
  return { code: data as string };
}

export async function revokeInviteAction(inviteId: string, studentId: string): Promise<{ error?: string }> {
  await requireTutor();
  const supabase = await createClient();

  const { error } = await supabase.rpc("revoke_invite", { p_invite_id: inviteId });
  revalidatePath(`/tutor/students/${studentId}`);
  if (error) return { error: error.message };
  return {};
}

export async function regenerateInviteAction(
  inviteId: string,
  studentId: string
): Promise<{ code?: string; error?: string }> {
  await requireTutor();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("regenerate_invite", { p_invite_id: inviteId });
  revalidatePath(`/tutor/students/${studentId}`);
  if (error) return { error: error.message };
  return { code: data as string };
}
