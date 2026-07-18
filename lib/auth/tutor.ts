import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { intendedRole } from "@/lib/auth/user";
import { backfillSignupAgreement, requireCurrentAgreement } from "@/lib/legal/gate";
import type { Tables } from "@/lib/database.types";

export type TutorRow = Tables<"tutors">;

/**
 * Fetches the tutor profile row, creating it (and a matching users row)
 * with defaults on first visit if the signup flow didn't already (e.g.
 * email-confirmation was required so the signup action couldn't insert
 * with an active session yet). Role resolution falls back to the intended
 * role captured in auth user_metadata at signup (not a "no row = tutor"
 * default) so a parent who hasn't been backfilled into `users` yet never
 * gets silently auto-provisioned as a tutor. Wrapped in React's cache() so
 * multiple calls within one request (layout + page) share one round trip.
 */
export const requireTutor = cache(async function requireTutor(): Promise<TutorRow> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: userRow } = await supabase
    .from("users")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const role = userRow?.role ?? intendedRole(user);
  if (role === "parent") redirect("/parent");

  const { data: existing } = await supabase
    .from("tutors")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (existing) {
    if (!userRow) {
      await supabase
        .from("users")
        .insert({ auth_user_id: user.id, role: "tutor", name: existing.name, email: existing.email });
    }
    // Unconditional now that backfillSignupAgreement is idempotent — closes
    // the race where a concurrent request already created `userRow` but its
    // own backfill insert hadn't committed yet when this request reached
    // requireCurrentAgreement.
    await backfillSignupAgreement(supabase, user);
    await requireCurrentAgreement(supabase, user.id);
    return existing;
  }

  const name = (user.user_metadata?.name as string | undefined) ?? user.email ?? "Tutor";
  const email = user.email ?? "";

  const { data: created, error } = await supabase
    .from("tutors")
    .insert({ auth_user_id: user.id, name, email })
    .select("*")
    .single();

  if (created) {
    await supabase.from("users").insert({ auth_user_id: user.id, role: "tutor", name, email });
    await backfillSignupAgreement(supabase, user);
    await requireCurrentAgreement(supabase, user.id);
    return created;
  }

  // Unique-violation: a concurrent request (e.g. two simultaneous /tutor
  // loads on first sign-in) already inserted the row. Fetch and return it.
  // Also run the same backfill the winning request ran — the winner's own
  // insert may not have committed yet by the time this request's query
  // runs, so without this a losing request can see no agreement row and
  // get bounced to /accept-terms despite having agreed at signup.
  if (error?.code === "23505") {
    const { data: raced } = await supabase
      .from("tutors")
      .select("*")
      .eq("auth_user_id", user.id)
      .single();
    if (raced) {
      await backfillSignupAgreement(supabase, user);
      await requireCurrentAgreement(supabase, user.id);
      return raced;
    }
  }

  throw new Error(error?.message ?? "Could not create tutor profile.");
});
