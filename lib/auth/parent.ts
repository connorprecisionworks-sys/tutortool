import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { intendedRole } from "@/lib/auth/user";
import { backfillSignupAgreement, requireCurrentAgreement } from "@/lib/legal/gate";
import type { Tables } from "@/lib/database.types";

export type ParentUserRow = Tables<"users">;

/**
 * Fetches the parent's `users` row, lazily creating it if this is the
 * first request after a deferred-email-confirmation signup (signUpParentAction
 * couldn't insert with no active session yet). Creation is gated on the
 * intended role captured in auth user_metadata at signup, not a blind
 * "first visitor to /parent must be a parent" assumption — a tutor
 * navigating to /parent by URL still gets redirected to /tutor rather than
 * silently gaining a parent users row. Wrapped in React's cache() so
 * multiple calls within one request (layout + page) share one round trip.
 */
export const requireParent = cache(async function requireParent(): Promise<ParentUserRow> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: existing } = await supabase
    .from("users")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (existing) {
    if (existing.role !== "parent") redirect("/tutor");
    // Unconditional now that backfillSignupAgreement is idempotent — this
    // branch previously never backfilled at all, leaving no self-healing
    // path if the original backfill (in the `created` branch below) had
    // failed or lost a race.
    await backfillSignupAgreement(supabase, user);
    await requireCurrentAgreement(supabase, user.id);
    return existing;
  }

  if (intendedRole(user) !== "parent") redirect("/tutor");

  const name = (user.user_metadata?.name as string | undefined) ?? user.email ?? "Parent";
  const email = user.email ?? "";

  const { data: created, error } = await supabase
    .from("users")
    .insert({ auth_user_id: user.id, role: "parent", name, email })
    .select("*")
    .single();

  if (created) {
    await backfillSignupAgreement(supabase, user);
    await requireCurrentAgreement(supabase, user.id);
    return created;
  }

  // Unique-violation: a concurrent request already inserted the row. Also
  // run the same backfill the winning request ran — the winner's own
  // insert may not have committed yet by the time this request's query
  // runs, so without this a losing request can see no agreement row and
  // get bounced to /accept-terms despite having agreed at signup.
  if (error?.code === "23505") {
    const { data: raced } = await supabase
      .from("users")
      .select("*")
      .eq("auth_user_id", user.id)
      .single();
    if (raced) {
      await backfillSignupAgreement(supabase, user);
      await requireCurrentAgreement(supabase, user.id);
      return raced;
    }
  }

  redirect("/login");
});
