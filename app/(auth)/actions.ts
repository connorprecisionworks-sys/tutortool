"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPostHogClient } from "@/lib/posthog-server";
import { TERMS_DOC, PRIVACY_DOC } from "@/lib/legal/docs";

export interface AuthActionResult {
  error?: string;
  needsEmailConfirmation?: boolean;
}

export async function signInAction(formData: FormData): Promise<AuthActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: error.message };
  return {};
}

async function signUpWithRole(role: "tutor" | "parent", formData: FormData): Promise<AuthActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const agreed = formData.get("agree") === "on";

  if (!name) return { error: "Name is required." };
  // Server-side enforcement, not just the disabled client button — this is
  // the actual legal gate, so a crafted/JS-disabled POST can't skip it.
  if (!agreed) return { error: "You must agree to the Terms of Service and Privacy Policy to continue." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        role,
        // Stashed here (not written to `agreements` yet) because if email
        // confirmation is required there's no session/RLS context to write
        // with — requireTutor/requireParent's backfillSignupAgreement picks
        // this up the first time a session exists, same pattern as
        // intendedRole's role backfill below.
        agreed_terms_version: TERMS_DOC.version,
        agreed_privacy_version: PRIVACY_DOC.version,
      },
    },
  });

  if (error) return { error: error.message };

  if (!data.session) {
    return { needsEmailConfirmation: true };
  }

  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: data.user!.id,
    event: role === "tutor" ? "tutor_signed_up" : "parent_signed_up",
    properties: { role },
  });
  posthog.identify({
    distinctId: data.user!.id,
    properties: { role, name },
  });
  await posthog.flush();

  // Session exists immediately (email confirmations off) — create the
  // profile row(s) now so the shell layout doesn't have to special-case a
  // missing row on first load.
  if (role === "tutor") {
    const { error: profileError } = await supabase.from("tutors").insert({
      auth_user_id: data.user!.id,
      name,
      email,
    });
    // Ignore unique-violation races (row already created by a concurrent request).
    if (profileError && profileError.code !== "23505") {
      return { error: profileError.message };
    }
  }

  const { error: userRowError } = await supabase.from("users").insert({
    auth_user_id: data.user!.id,
    role,
    name,
    email,
  });
  if (userRowError && userRowError.code !== "23505") {
    return { error: userRowError.message };
  }

  // Legal proof of consent — recorded server-side now, not left as client
  // state. Non-fatal on failure: requireCurrentAgreement will still catch a
  // missing row on this user's first shell load and send them to
  // /accept-terms to record it there instead.
  const { error: agreementError } = await supabase.from("agreements").insert({
    auth_user_id: data.user!.id,
    terms_version: TERMS_DOC.version,
    privacy_version: PRIVACY_DOC.version,
  });
  // Ignore unique-violation races, same as the tutors/users inserts above.
  if (agreementError && agreementError.code !== "23505") {
    console.error("Failed to record signup agreement:", agreementError.message);
  }

  return {};
}

export async function signUpTutorAction(formData: FormData): Promise<AuthActionResult> {
  const result = await signUpWithRole("tutor", formData);
  // Redirect server-side rather than leaving it to the client's
  // `router.push("/tutor"); router.refresh()` — that pairing races (see the
  // comment in accept-terms/actions.ts) and, chained right after signup,
  // could land a brand-new tutor back on a stale pre-signup render instead
  // of the dashboard. No further client-only work follows a tutor signup
  // (unlike parent signup's optional code redemption), so this can redirect
  // unconditionally.
  if (!result.error && !result.needsEmailConfirmation) redirect("/tutor");
  return result;
}

export async function signUpParentAction(formData: FormData): Promise<AuthActionResult> {
  return signUpWithRole("parent", formData);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Server-side redirect — the two former call sites (the main app shell,
  // the accept-terms gate's "sign out instead" escape hatch) each did their
  // own client-side `router.push("/login")` (one paired with a racy
  // `router.refresh()`, see accept-terms/actions.ts), which is how a second,
  // slightly different navigation path could end up landing somewhere other
  // than /login. One server action, one destination, no client navigation
  // logic to duplicate or drift.
  redirect("/login");
}
