"use server";

import { createClient } from "@/lib/supabase/server";
import { TERMS_DOC, PRIVACY_DOC } from "@/lib/legal/docs";

export interface AcceptTermsResult {
  error?: string;
}

export async function acceptTermsAction(formData: FormData): Promise<AcceptTermsResult> {
  const agreed = formData.get("agree") === "on";
  if (!agreed) return { error: "You must agree to continue." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired — please sign in again." };

  const { error } = await supabase.from("agreements").insert({
    auth_user_id: user.id,
    terms_version: TERMS_DOC.version,
    privacy_version: PRIVACY_DOC.version,
  });
  // A unique-violation here just means this exact version pair was already
  // recorded (e.g. a double-submit, or backfill already ran) — that's the
  // desired end state, not a failure to surface to the user.
  if (error && error.code !== "23505") return { error: error.message };

  return {};
}
