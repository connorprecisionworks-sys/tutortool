"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";

export interface PublicProfileFormResult {
  error?: string;
  success?: boolean;
}

// Trailing group is mandatory (no `?`) so the minimum match length is
// 1 + 1 + 1 = 3 chars, matching the "3-32 characters" copy shown to the
// tutor — an earlier optional-group version accepted 1-character handles.
const HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;

export async function updatePublicProfileAction(
  _prev: PublicProfileFormResult,
  formData: FormData
): Promise<PublicProfileFormResult> {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const handleRaw = String(formData.get("handle") ?? "").trim().toLowerCase();
  const bio = String(formData.get("bio") ?? "").trim();
  const subjects = String(formData.get("subjects") ?? "").trim();
  const isPublic = formData.get("is_public") === "on";
  const showBio = formData.get("show_bio") === "on";
  const showPrices = formData.get("show_prices") === "on";

  if (isPublic && !handleRaw) return { error: "Pick a handle before publishing your page." };
  if (handleRaw && !HANDLE_RE.test(handleRaw)) {
    return { error: "Handle can only use lowercase letters, numbers, and hyphens (3-32 characters)." };
  }

  const { error } = await supabase
    .from("tutors")
    .update({
      handle: handleRaw || null,
      bio: bio || null,
      subjects: subjects || null,
      is_public: isPublic,
      show_bio: showBio,
      show_prices: showPrices,
    })
    .eq("id", tutor.id);

  if (error) {
    // Postgres unique_violation on the case-insensitive handle index.
    if (error.code === "23505") return { error: "That handle is already taken." };
    return { error: error.message };
  }

  revalidatePath("/tutor/settings");
  return { success: true };
}
