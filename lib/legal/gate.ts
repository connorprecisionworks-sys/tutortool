import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { TERMS_DOC, PRIVACY_DOC } from "@/lib/legal/docs";

function intendedAgreement(user: User): { termsVersion: string; privacyVersion: string } | null {
  const termsVersion = user.user_metadata?.agreed_terms_version;
  const privacyVersion = user.user_metadata?.agreed_privacy_version;
  if (typeof termsVersion === "string" && typeof privacyVersion === "string") {
    return { termsVersion, privacyVersion };
  }
  return null;
}

/**
 * Persists the agreement captured at signup (stashed in user_metadata
 * because deferred email confirmation left no session/RLS context to write
 * with yet) the first time a `users`/`tutors` row is lazily created for
 * this user — mirrors intendedRole's own backfill, same reason.
 *
 * Safe to call unconditionally from every requireTutor/requireParent
 * branch (not just the branch that happens to create the row) — a unique
 * constraint on (auth_user_id, terms_version, privacy_version) makes this
 * idempotent, so two concurrent requests both backfilling the same signup
 * event silently collapse to one row instead of leaving a duplicate in
 * what's documented as an immutable legal audit record.
 */
export async function backfillSignupAgreement(supabase: SupabaseClient<Database>, user: User) {
  const agreement = intendedAgreement(user);
  if (!agreement) return;
  const { error } = await supabase.from("agreements").insert({
    auth_user_id: user.id,
    terms_version: agreement.termsVersion,
    privacy_version: agreement.privacyVersion,
  });
  if (error && error.code !== "23505") {
    console.error("Failed to backfill signup agreement:", error.message);
  }
}

/**
 * Legal consent gate: redirects to /accept-terms unless the user's most
 * recently accepted Terms/Privacy versions match what's currently published
 * (TERMS_DOC/PRIVACY_DOC, read straight from legal/*.md — never a
 * hand-maintained duplicate that could drift). Called from
 * requireTutor/requireParent, the same choke point the C1 onboarding gate
 * uses, so it covers every /tutor/* and /parent/* render — a user is only
 * ever prompted until they accept, then never again until the docs change.
 */
export async function requireCurrentAgreement(supabase: SupabaseClient<Database>, authUserId: string) {
  const { data: latest, error } = await supabase
    .from("agreements")
    .select("terms_version, privacy_version")
    .eq("auth_user_id", authUserId)
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // A query failure looks identical to "never accepted" if left unchecked
  // (both leave `latest` empty) — still fail closed and re-prompt (safer
  // default for a legal consent gate than silently letting a stale
  // acceptance through), but log it so a sustained failure is diagnosable
  // instead of reading as ordinary re-prompting.
  if (error) {
    console.error("Failed to check agreement status:", error.message);
  }

  const current =
    latest?.terms_version === TERMS_DOC.version && latest?.privacy_version === PRIVACY_DOC.version;

  if (!current) {
    // Carries the user back to where the gate interrupted them, same
    // pattern as the unauthenticated redirect in lib/supabase/middleware.ts
    // (?next=<pathname>) — x-pathname is set there since Server Components
    // have no other way to recover the current request's pathname.
    const pathname = (await headers()).get("x-pathname") ?? "/";
    redirect(`/accept-terms?next=${encodeURIComponent(pathname)}`);
  }
}
