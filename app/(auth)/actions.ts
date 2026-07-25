"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPostHogClient } from "@/lib/posthog-server";
import { TERMS_DOC, PRIVACY_DOC } from "@/lib/legal/docs";
import { checkIpRateLimit, checkRateLimit, resetRateLimit } from "@/lib/rate-limit";

export interface AuthActionResult {
  error?: string;
  needsEmailConfirmation?: boolean;
}

// Shown for both a real invalid-credentials failure and a rate-limited one
// (see signInAction) — a distinct "too many attempts" message on the
// rate-limited path would itself be a signal an attacker could use to tell
// when they've been throttled vs. just guessed wrong. Below, signInAction
// substitutes this same constant in place of GoTrue's own message whenever
// its error code is "invalid_credentials", so the two paths are guaranteed
// byte-identical by construction — this doesn't depend on guessing GoTrue's
// exact wording (UNCONFIRMED against live Supabase Auth in this session; no
// network calls were made under this task's constraints).
const INVALID_CREDENTIALS_MESSAGE = "Invalid login credentials";

export async function signInAction(formData: FormData): Promise<AuthActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const normalizedEmail = email.toLowerCase();

  const supabase = await createClient();

  // Two independent limiters, both must pass. IP alone doesn't stop
  // credential stuffing (cheap residential-proxy pools rotate IPs freely),
  // and email alone doesn't stop one source hammering many accounts — see
  // supabase/migrations/20260724100000_sec4_login_account_rate_limit.sql
  // (NOT YET APPLIED) for the reset_rate_limit() this relies on below.
  // Layered on top of whatever Supabase Auth's own GoTrue rate limits
  // already provide, not a replacement for them.
  const emailKey = `signin-email:${normalizedEmail}`;
  const emailHourlyKey = `${emailKey}:hourly`;
  const [ipOk, emailOk, emailHourlyOk] = await Promise.all([
    checkIpRateLimit(supabase, "signin", 20, 600),
    checkRateLimit(supabase, emailKey, 5, 900),
    checkRateLimit(supabase, emailHourlyKey, 20, 3600),
  ]);
  if (!ipOk || !emailOk || !emailHourlyOk) {
    // Same message and a comparable delay to a real signInWithPassword
    // round trip — GoTrue's own password check has real crypto latency we
    // can't replicate exactly without calling it, so this is a best-effort
    // delay match (not a constant-time guarantee), just enough that an
    // instant response isn't itself a tell that this attempt got throttled.
    await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 150));
    return { error: INVALID_CREDENTIALS_MESSAGE };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Normalized to the exact same string as the rate-limited path above
    // for "invalid_credentials" specifically — guarantees the two are
    // indistinguishable by construction. Other GoTrue error codes (e.g.
    // "email_not_confirmed") are unrelated to this task and pass through
    // unchanged, same as before.
    return { error: error.code === "invalid_credentials" ? INVALID_CREDENTIALS_MESSAGE : error.message };
  }

  // Successful login — give this email's attempt budget back rather than
  // leaving a legitimate user who fumbled a password twice one or two
  // failed attempts away from being locked out on their next visit.
  // Best-effort: never block/undo a successful login on a reset failure.
  await Promise.all([resetRateLimit(supabase, emailKey), resetRateLimit(supabase, emailHourlyKey)]);

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

  // Anonymous, DB-writing, fully scriptable endpoint — cap sign-up attempts
  // per IP so a script can't mass-create accounts.
  if (!(await checkIpRateLimit(supabase, "signup", 10, 3600))) {
    return { error: "Too many attempts. Please wait a while and try again." };
  }
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
