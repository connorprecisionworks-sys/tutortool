"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";

export interface NoteFormResult {
  error?: string;
  success?: boolean;
}

export async function saveSessionNoteAction(
  _prev: NoteFormResult,
  formData: FormData
): Promise<NoteFormResult> {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const sessionId = String(formData.get("session_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const shared = formData.get("shared") === "on";

  if (!sessionId) return { error: "Missing session." };
  if (!body) return { error: "Note can't be empty." };

  const { error } = await supabase
    .from("session_notes")
    .upsert(
      { session_id: sessionId, tutor_id: tutor.id, body, shared, updated_at: new Date().toISOString() },
      { onConflict: "session_id" }
    );

  if (error) return { error: error.message };

  revalidatePath(`/tutor/sessions/${sessionId}`);
  revalidatePath("/parent/sessions");
  return { success: true };
}

export async function deleteSessionNoteAction(sessionId: string): Promise<NoteFormResult> {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const { error } = await supabase
    .from("session_notes")
    .delete()
    .eq("session_id", sessionId)
    .eq("tutor_id", tutor.id);

  if (error) return { error: error.message };

  revalidatePath(`/tutor/sessions/${sessionId}`);
  revalidatePath("/parent/sessions");
  return {};
}
