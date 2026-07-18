"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTutor } from "@/lib/auth/tutor";
import type { TablesUpdate } from "@/lib/database.types";

export interface PublicProfileFormResult {
  error?: string;
  success?: boolean;
}

// Trailing group is mandatory (no `?`) so the minimum match length is
// 1 + 1 + 1 = 3 chars, matching the "3-32 characters" copy shown to the
// tutor — an earlier optional-group version accepted 1-character handles.
const HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;

// Raster formats only — no image/svg+xml. An SVG is XML: a browser that
// opens the (public, unauthenticated) avatar URL directly executes any
// <script> it contains, in the storage origin's context. Every path here
// is a real image the browser will only ever decode as pixels.
const ALLOWED_AVATAR_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * C1's onboarding wizard submits this same action with a trimmed form that
 * doesn't render the C4 customization fields (public_display_name,
 * headline, welcome_note, booking_cta_label) at all — formData.has() tells
 * "field omitted, leave the column alone" apart from "field submitted
 * empty, clear it," so a step built before C4 shipped doesn't silently
 * wipe values only the fuller Settings form can set.
 */
function optionalField(formData: FormData, name: string): string | undefined {
  if (!formData.has(name)) return undefined;
  return String(formData.get(name) ?? "").trim();
}

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

  const publicDisplayName = optionalField(formData, "public_display_name");
  const headline = optionalField(formData, "headline");
  const welcomeNote = optionalField(formData, "welcome_note");
  const bookingCtaLabel = optionalField(formData, "booking_cta_label");

  const updates: TablesUpdate<"tutors"> = {
    handle: handleRaw || null,
    bio: bio || null,
    subjects: subjects || null,
    is_public: isPublic,
    show_bio: showBio,
    show_prices: showPrices,
  };
  if (publicDisplayName !== undefined) updates.public_display_name = publicDisplayName || null;
  if (headline !== undefined) updates.headline = headline || null;
  if (welcomeNote !== undefined) updates.welcome_note = welcomeNote || null;
  if (bookingCtaLabel !== undefined) updates.booking_cta_label = bookingCtaLabel || "Book";

  // Upload happens before the row update (same order as the receipts
  // pattern in expenses actions) so a failed upload never leaves the row
  // pointing at a path that was never written; a failed row update after a
  // successful upload cleans up the now-orphaned file instead of leaking it.
  const avatarFile = formData.get("avatar");
  let newAvatarPath: string | null = null;
  if (avatarFile instanceof File && avatarFile.size > 0) {
    if (avatarFile.size > 5 * 1024 * 1024) return { error: "Photo must be under 5 MB." };
    const extension = ALLOWED_AVATAR_TYPES[avatarFile.type];
    if (!extension) return { error: "Photo must be a PNG, JPEG, WEBP, or GIF." };

    // The path is built entirely from server-generated values (tutor.id,
    // a fresh UUID, an extension resolved from an allowlist) — the
    // client's original filename never touches it. This bucket is public
    // and has no storage.objects RLS (writes only ever happen through
    // this admin-client path), so a filename like "../<other-uuid>/x.png"
    // sailing straight into the storage key would otherwise let a tutor
    // plant a file inside another tutor's public namespace.
    const path = `${tutor.id}/${randomUUID()}.${extension}`;
    const admin = createAdminClient();
    const { error: uploadError } = await admin.storage.from("avatars").upload(path, avatarFile, {
      contentType: avatarFile.type,
    });
    if (uploadError) return { error: uploadError.message };
    newAvatarPath = path;
    updates.avatar_path = path;
  }

  // Read the avatar path fresh right before overwriting it — not the
  // `tutor` object captured at the top of the request — so the window for
  // two concurrent saves (e.g. two open Settings tabs) to both read the
  // same pre-update path and orphan one of the two freshly-uploaded files
  // is as small as one query away from the update, not a whole request
  // round-trip away from it. Not a hard transactional guarantee, but the
  // entire failure cost here is a harmless leaked file, not a correctness
  // or security issue, so a real DB-side lock wasn't worth adding for it.
  let previousAvatarPath: string | null = null;
  if (newAvatarPath) {
    const { data: current } = await supabase.from("tutors").select("avatar_path").eq("id", tutor.id).single();
    previousAvatarPath = current?.avatar_path ?? null;
  }

  const { error } = await supabase.from("tutors").update(updates).eq("id", tutor.id);

  if (error) {
    if (newAvatarPath) {
      const admin = createAdminClient();
      await admin.storage.from("avatars").remove([newAvatarPath]);
    }
    // Postgres unique_violation on the case-insensitive handle index.
    if (error.code === "23505") return { error: "That handle is already taken." };
    return { error: error.message };
  }

  // Old avatar cleanup happens after the row update succeeds and points at
  // the new path — best-effort, logged not surfaced, same as every other
  // storage-cleanup call in this app (a leaked old file costs nothing
  // functionally, unlike a failure blocking the save the tutor is waiting on).
  if (newAvatarPath && previousAvatarPath && previousAvatarPath !== newAvatarPath) {
    const admin = createAdminClient();
    const { error: cleanupError } = await admin.storage.from("avatars").remove([previousAvatarPath]);
    if (cleanupError) console.error(`Failed to remove old avatar for tutor ${tutor.id}:`, cleanupError.message);
  }

  revalidatePath("/tutor/settings");
  revalidatePath(`/t/${handleRaw}`);
  return { success: true };
}
