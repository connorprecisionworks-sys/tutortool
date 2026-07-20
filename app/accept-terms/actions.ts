"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TERMS_DOC, PRIVACY_DOC } from "@/lib/legal/docs";
import { safeNext } from "@/lib/auth/safe-redirect";

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

  // Redirect server-side, in the same request that just committed the
  // acceptance — the client previously did `router.push(next);
  // router.refresh()` instead, which races: refresh() re-fetches whatever
  // route was current *at dispatch time* (still /accept-terms, since
  // push()'s URL update hadn't committed yet) and can land after push()'s
  // own fetch resolves, overwriting the just-pushed navigation and leaving
  // the user stuck on the stale gated page despite the insert having
  // succeeded. A server-side redirect has no such race: the client
  // navigates straight to `next`, which re-runs requireCurrentAgreement
  // fresh and sees the row this same request just wrote.
  redirect(safeNext(formData.get("next") as string | null));
}
