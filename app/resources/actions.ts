"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ResourceUrlResult {
  url?: string;
  error?: string;
}

/**
 * Shared by both the tutor and parent shells. Authorization is entirely
 * the `resources` table's own RLS: if the authenticated caller's client
 * can SELECT the row (tutor-own OR parent-of-linked-student/class), they're
 * allowed to open it. For file-type resources the admin client then mints
 * a short-lived signed URL — Storage itself has no RLS policies at all, so
 * this table-level check is the only gate.
 */
export async function getResourceUrlAction(resourceId: string): Promise<ResourceUrlResult> {
  const supabase = await createClient();

  const { data: resource } = await supabase
    .from("resources")
    .select("*")
    .eq("id", resourceId)
    .maybeSingle();

  if (!resource) return { error: "Resource not found." };

  if (resource.type === "link") {
    return { url: resource.url_or_path };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("resources")
    .createSignedUrl(resource.url_or_path, 60 * 5);

  if (error || !data) return { error: error?.message ?? "Could not generate a download link." };

  return { url: data.signedUrl };
}
