"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkIpRateLimit } from "@/lib/rate-limit";
import { getPostHogClient } from "@/lib/posthog-server";

export interface WaitlistActionResult {
  error?: string;
  /** Echoed back on success so the form's optional survey step can attach answers to the same row. */
  email?: string;
}

const EmailSchema = z.email();

// Survey answers are free text but bounded — these are marketing-survey
// fields, not app data, so the only server-side concern is that someone
// can't stuff megabytes into a row.
const SurveySchema = z.object({
  email: z.email(),
  subjects: z.string().max(200).optional(),
  numStudents: z.string().max(50).optional(),
});

/**
 * Pre-launch waitlist signup from the landing page. Anonymous, DB-writing,
 * fully scriptable endpoint — IP rate-limited like signup/booking (fails
 * closed on an unresolvable IP, see checkIpRateLimit). Writes through the
 * join_waitlist SECURITY DEFINER function (see
 * supabase/migrations/20260725090000_waitlist.sql — NOT YET APPLIED), which
 * treats a duplicate email as a clean success so this action can't be used
 * to probe who's already signed up.
 */
export async function joinWaitlistAction(
  _prev: WaitlistActionResult,
  formData: FormData
): Promise<WaitlistActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const source = String(formData.get("source") ?? "landing");

  const parsed = EmailSchema.safeParse(email);
  if (!parsed.success) {
    return { error: "Enter a valid email address." };
  }

  const supabase = await createClient();

  if (!(await checkIpRateLimit(supabase, "waitlist", 5, 3600))) {
    return { error: "Too many attempts. Please try again in a little while." };
  }

  const { error } = await supabase.rpc("join_waitlist", {
    p_email: parsed.data,
    p_source: source.slice(0, 50),
  });

  if (error) {
    // Covers the migration-not-yet-applied case too (function missing) —
    // log the real cause, never surface a raw Postgres error to a visitor.
    console.error("join_waitlist failed:", error.message);
    return { error: "Something went wrong on our end — please try again in a moment." };
  }

  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: parsed.data,
    event: "waitlist_joined",
    properties: { source },
  });
  await posthog.flush();

  return { email: parsed.data };
}

/**
 * Optional second step: attach survey answers (subjects taught, roster size)
 * to an email already on the list. join_waitlist coalesces on conflict, so
 * this is the same RPC — it updates the existing row rather than inserting.
 * Best-effort from the visitor's perspective: they're already on the list,
 * so a failure here still reads as done.
 */
export async function submitWaitlistSurveyAction(
  _prev: WaitlistActionResult,
  formData: FormData
): Promise<WaitlistActionResult> {
  const parsed = SurveySchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    subjects: String(formData.get("subjects") ?? "").trim() || undefined,
    numStudents: String(formData.get("num_students") ?? "").trim() || undefined,
  });
  if (!parsed.success) {
    return { error: "Enter a valid email address." };
  }

  const supabase = await createClient();

  // Same bucket as the join step — the pair of calls a real visitor makes
  // fits comfortably in 5/hour, and a shared bucket keeps this from being a
  // side door for hammering the RPC.
  if (!(await checkIpRateLimit(supabase, "waitlist", 5, 3600))) {
    return { error: "Too many attempts. Please try again in a little while." };
  }

  const { error } = await supabase.rpc("join_waitlist", {
    p_email: parsed.data.email,
    p_subjects: parsed.data.subjects,
    p_num_students: parsed.data.numStudents,
  });

  if (error) {
    console.error("join_waitlist (survey) failed:", error.message);
    return { error: "Couldn't save that — but you're on the list." };
  }

  return { email: parsed.data.email };
}
