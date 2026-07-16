"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { buildInviteEmailHtml } from "@/lib/invite-email";
import { studentJoinLink } from "@/lib/invite-link";

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

/**
 * Best-effort "pending invite" tracker for the copy-message flow — the
 * tutor already copied the message to their own clipboard by the time this
 * fires, so a failure here (e.g. no email entered) shouldn't surface as an
 * error; it just means this contact won't show up under "Pending" until
 * they join by some other trace (or the tutor logs a send another way).
 */
export async function logInviteCopyAction(
  studentId: string,
  parentName: string,
  parentEmail: string
): Promise<{ error?: string }> {
  await requireTutor();
  if (!parentEmail.trim()) return { error: "No parent email entered." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("log_invite_send", {
    p_student_id: studentId,
    p_parent_name: (parentName.trim() || null) as unknown as string,
    p_parent_email: parentEmail.trim(),
    p_channel: "copy",
  });
  revalidatePath(`/tutor/students/${studentId}`);
  if (error) return { error: error.message };
  return {};
}

export interface SendInviteEmailResult {
  error?: string;
}

export async function sendInviteEmailAction(
  studentId: string,
  parentName: string,
  parentEmail: string
): Promise<SendInviteEmailResult> {
  const tutor = await requireTutor();

  const email = parentEmail.trim();
  if (!email) return { error: "Enter a parent email first." };
  if (!isEmailConfigured()) return { error: "Email isn't configured on this deployment yet." };

  const supabase = await createClient();

  const { data: student, error: studentError } = await supabase
    .from("clients")
    .select("student_name")
    .eq("id", studentId)
    .eq("tutor_id", tutor.id)
    .maybeSingle();
  if (studentError) return { error: studentError.message };
  if (!student) return { error: "Student not found." };

  const { data: invite, error: inviteError } = await supabase
    .from("invites")
    .select("code")
    .eq("student_id", studentId)
    .eq("status", "active")
    .maybeSingle();
  if (inviteError) return { error: inviteError.message };
  if (!invite) return { error: "No active Student Code — regenerate one first." };

  const link = studentJoinLink(invite.code);
  const logoUrl = process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/brand/logo/slate-logo-on-light.png` : null;

  const sendResult = await sendEmail({
    to: email,
    subject: `You're invited to Slate for ${student.student_name}`,
    html: buildInviteEmailHtml({
      tutorName: tutor.name,
      studentName: student.student_name,
      parentName,
      link,
      code: invite.code,
      logoUrl,
    }),
  });
  if (sendResult.error) return { error: sendResult.error };

  const { error: logError } = await supabase.rpc("log_invite_send", {
    p_student_id: studentId,
    p_parent_name: (parentName.trim() || null) as unknown as string,
    p_parent_email: email,
    p_channel: "email",
  });
  if (logError) return { error: `Email sent, but couldn't record it: ${logError.message}` };

  revalidatePath(`/tutor/students/${studentId}`);
  return {};
}
