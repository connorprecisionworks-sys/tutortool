"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTutor } from "@/lib/auth/tutor";

export interface ResourceFormResult {
  error?: string;
}

export async function createResourceAction(
  _prev: ResourceFormResult,
  formData: FormData
): Promise<ResourceFormResult> {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  const studentId = String(formData.get("student_id") ?? "");
  const type = String(formData.get("type") ?? "link");

  if (!title) return { error: "Title is required." };
  if (!studentId) return { error: "Pick a student." };

  let urlOrPath: string;
  let file: File | null = null;

  if (type === "link") {
    const url = String(formData.get("url") ?? "").trim();
    if (!url) return { error: "Enter a URL." };
    try {
      new URL(url);
    } catch {
      return { error: "Enter a valid URL (including https://)." };
    }
    urlOrPath = url;
  } else {
    const maybeFile = formData.get("file");
    if (!(maybeFile instanceof File) || maybeFile.size === 0) return { error: "Choose a file to upload." };
    if (maybeFile.size > 20 * 1024 * 1024) return { error: "Files must be under 20 MB." };
    file = maybeFile;
    urlOrPath = `${tutor.id}/${randomUUID()}-${file.name}`;
  }

  // Insert the row first, then upload — if the upload fails we delete the
  // row we just created so we never end up with an orphaned storage
  // object with nothing to clean it up later (the previous upload-first
  // ordering could leak a file forever if the insert failed afterward).
  const { data: inserted, error: insertError } = await supabase
    .from("resources")
    .insert({
      tutor_id: tutor.id,
      student_id: studentId,
      title,
      type: type === "link" ? "link" : "file",
      url_or_path: urlOrPath,
    })
    .select("id")
    .single();

  if (insertError || !inserted) return { error: insertError?.message ?? "Could not save resource." };

  if (file) {
    const admin = createAdminClient();
    const { error: uploadError } = await admin.storage
      .from("resources")
      .upload(urlOrPath, file, { contentType: file.type || undefined });

    if (uploadError) {
      await supabase.from("resources").delete().eq("id", inserted.id);
      return { error: uploadError.message };
    }
  }

  revalidatePath("/tutor/resources");
  return {};
}

export async function deleteResourceAction(resourceId: string): Promise<{ error?: string }> {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const { data: resource } = await supabase
    .from("resources")
    .select("*")
    .eq("id", resourceId)
    .eq("tutor_id", tutor.id)
    .maybeSingle();

  if (!resource) return { error: "Resource not found." };

  if (resource.type === "file") {
    const admin = createAdminClient();
    const { error: storageError } = await admin.storage.from("resources").remove([resource.url_or_path]);
    if (storageError) {
      console.error(`Failed to remove storage object for resource ${resourceId}:`, storageError.message);
      return { error: "Could not remove the file. Try again." };
    }
  }

  const { error } = await supabase.from("resources").delete().eq("id", resourceId);
  if (error) return { error: error.message };

  revalidatePath("/tutor/resources");
  return {};
}
