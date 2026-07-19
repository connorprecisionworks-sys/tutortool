"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ResourceUrlResult {
  url?: string;
  error?: string;
}

/**
 * Shared by both the tutor and parent shells, but the two take different
 * paths since D13: the tutor's own resources_select_own RLS still grants a
 * direct table read (a tutor can always open/preview their own resource
 * regardless of gate status — they need to manage it). A parent has no
 * direct SELECT policy on `resources` at all anymore (D13 dropped
 * resources_select_parent) — Postgres RLS can't null out a single locked
 * resource's url_or_path on an otherwise-visible row, so parent reads go
 * through get_parent_resource_url(), a SECURITY DEFINER function that does
 * that column-level masking and re-checks parent-of-student itself. For
 * file-type resources the admin client then mints a short-lived signed URL
 * — Storage itself has no RLS policies at all, so this check is the only
 * gate either path relies on.
 */
export async function getResourceUrlAction(resourceId: string): Promise<ResourceUrlResult> {
  const supabase = await createClient();

  const { data: ownResource } = await supabase
    .from("resources")
    .select("*")
    .eq("id", resourceId)
    .maybeSingle();

  if (ownResource) {
    return signOrReturnUrl(ownResource.type, ownResource.url_or_path);
  }

  const { data: parentView, error } = await supabase
    .rpc("get_parent_resource_url", { p_resource_id: resourceId })
    .maybeSingle();

  if (error || !parentView) return { error: "Resource not found." };
  if (parentView.locked) return { error: "This resource is locked until it's paid for." };

  return signOrReturnUrl(parentView.type, parentView.url_or_path);
}

async function signOrReturnUrl(type: string, urlOrPath: string | null): Promise<ResourceUrlResult> {
  if (!urlOrPath) return { error: "Resource not found." };
  if (type === "link") return { url: urlOrPath };

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("resources").createSignedUrl(urlOrPath, 60 * 5);

  if (error || !data) return { error: error?.message ?? "Could not generate a download link." };

  return { url: data.signedUrl };
}
