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

export async function updateResourceAction(
  _prev: ResourceFormResult,
  formData: FormData
): Promise<ResourceFormResult> {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const resourceId = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!resourceId) return { error: "Missing resource id." };
  if (!title) return { error: "Title is required." };

  const { data: existing } = await supabase
    .from("resources")
    .select("*")
    .eq("id", resourceId)
    .eq("tutor_id", tutor.id)
    .maybeSingle();

  if (!existing) return { error: "Resource not found." };

  const update: { title: string; url_or_path?: string } = { title };

  // Only a link's target is editable in place — a file resource's
  // underlying storage object isn't touched by this action (re-uploading
  // is a delete + re-add, same as before this change).
  if (existing.type === "link") {
    const { data: gate } = await supabase
      .from("resource_gates")
      .select("status")
      .eq("resource_id", resourceId)
      .maybeSingle();
    if (gate?.status === "unlocked") {
      return { error: "This resource was paid for and unlocked — its link can't be changed anymore." };
    }

    const url = String(formData.get("url") ?? "").trim();
    if (!url) return { error: "Enter a URL." };
    try {
      new URL(url);
    } catch {
      return { error: "Enter a valid URL (including https://)." };
    }
    update.url_or_path = url;
  }

  const { error } = await supabase.from("resources").update(update).eq("id", resourceId);
  if (error) return { error: error.message };

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

  const { data: gate } = await supabase
    .from("resource_gates")
    .select("status, unlock_invoice_id")
    .eq("resource_id", resourceId)
    .maybeSingle();
  if (gate && (gate.status === "unlocked" || gate.unlock_invoice_id)) {
    return {
      error:
        gate.status === "unlocked"
          ? "This resource was paid for and unlocked — it can't be deleted."
          : "This resource is on a draft invoice — remove it from the invoice first.",
    };
  }

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

export async function setResourceGateAction(
  _prev: ResourceFormResult,
  formData: FormData
): Promise<ResourceFormResult> {
  await requireTutor();
  const supabase = await createClient();

  const resourceId = String(formData.get("resource_id") ?? "");
  const priceDollars = Number(formData.get("price") ?? "0");
  if (!resourceId) return { error: "Missing resource id." };
  if (!priceDollars || Number.isNaN(priceDollars) || priceDollars <= 0) {
    return { error: "Enter a price greater than zero." };
  }

  const { error } = await supabase.rpc("set_resource_gate", {
    p_resource_id: resourceId,
    p_price_cents: Math.round(priceDollars * 100),
  });
  if (error) return { error: error.message };

  revalidatePath("/tutor/resources");
  return {};
}

export async function removeResourceGateAction(resourceId: string): Promise<{ error?: string }> {
  await requireTutor();
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_resource_gate", { p_resource_id: resourceId });
  revalidatePath("/tutor/resources");
  if (error) return { error: error.message };
  return {};
}

export async function manuallyUnlockResourceGateAction(gateId: string): Promise<{ error?: string }> {
  await requireTutor();
  const supabase = await createClient();
  const { error } = await supabase.rpc("manually_unlock_resource_gate", { p_gate_id: gateId });
  revalidatePath("/tutor/resources");
  if (error) return { error: error.message };
  return {};
}
