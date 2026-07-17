"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { buildBookingConfirmedEmailHtml } from "@/lib/booking-link-email";
import { formatBookingWhen } from "@/lib/scheduling";
import { appUrl } from "@/lib/env";
import { interpolateTemplate, type ReminderTemplates } from "@/lib/reminders";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface OpenAvailabilitySlotsResult {
  slots: string[];
  error?: string;
}

/**
 * Same "anon RPC through a server action, not a client-side Supabase call"
 * shape as confirmBookingLinkAction — the visitor has no session either
 * way, but every anonymous read/write in this app goes through this one
 * path rather than a second, browser-side call pattern.
 */
export async function getOpenAvailabilitySlotsAction(
  token: string,
  date: string
): Promise<OpenAvailabilitySlotsResult> {
  if (!DATE_RE.test(date)) return { slots: [], error: "Invalid date." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_open_availability_slots", { p_token: token, p_date: date });

  if (error) return { slots: [], error: error.message };
  const result = data as unknown as { slots: string[] } | null;
  return { slots: result?.slots ?? [] };
}

export interface ConfirmBookingResult {
  error?: string;
  bookingLinkId?: string;
}

export async function confirmBookingLinkAction(
  _prev: ConfirmBookingResult,
  formData: FormData
): Promise<ConfirmBookingResult> {
  const token = String(formData.get("token") ?? "").trim();
  const slotId = String(formData.get("slot_id") ?? "").trim();
  const parentName = String(formData.get("parent_name") ?? "").trim();
  const parentEmail = String(formData.get("parent_email") ?? "").trim();
  const studentName = String(formData.get("student_name") ?? "").trim();

  if (!token || !slotId) return { error: "Missing booking details." };
  if (!parentEmail) return { error: "Email is required." };

  // The anonymous visitor has no Supabase session, so this client acts as
  // the `anon` role — confirm_booking_link is specifically granted to
  // that role (see the Q2 migration) rather than relying on RLS, since
  // there's no auth.uid() to check policies against.
  const supabase = await createClient();

  const { data: bookingLinkId, error } = await supabase.rpc("confirm_booking_link", {
    p_token: token,
    p_slot_id: slotId,
    p_parent_name: (parentName || null) as unknown as string,
    p_parent_email: parentEmail,
    p_student_name: (studentName || null) as unknown as string,
  });

  if (error) return { error: error.message };

  // Best-effort tutor notification + parent confirmation — never block the
  // parent's confirmation on either. Needs the admin client since, same as
  // above, there's no user session here to read the tutor's row through
  // RLS (matches the existing "invite redemption that must bypass RLS
  // deliberately" precedent documented on lib/supabase/admin.ts). Also the
  // insert-to-claim for the confirmation reminder row (Q6) — this action
  // has no tutor session to call a SECURITY DEFINER function with, so it
  // uses the same admin client the cron job uses for its own reminder rows.
  try {
    const admin = createAdminClient();
    const { data: link } = await admin
      .from("booking_links")
      .select("tutor_id, session_id, tutors(name, email, reminder_templates), clients(student_name)")
      .eq("id", bookingLinkId)
      .maybeSingle();

    const tutor = link?.tutors as unknown as
      | { name: string; email: string; reminder_templates: ReminderTemplates }
      | null;
    const student = link?.clients as unknown as { student_name: string } | null;

    if (tutor && link?.session_id) {
      const { data: session } = await admin
        .from("sessions")
        .select("occurred_on, start_time")
        .eq("id", link.session_id)
        .maybeSingle();

      const whenText = session
        ? formatBookingWhen(`${session.occurred_on}T${session.start_time ?? "00:00:00"}.000Z`)
        : "the booked time";
      const studentName = student?.student_name ?? "a student";

      if (tutor.email) {
        if (isEmailConfigured()) {
          await sendEmail({
            to: tutor.email,
            subject: `New booking: ${studentName}`,
            html: buildBookingConfirmedEmailHtml({
              tutorName: tutor.name,
              studentName,
              parentName: parentName || null,
              whenText,
              sessionsUrl: `${appUrl()}/tutor/sessions`,
              logoUrl: `${appUrl()}/brand/logo/slate-logo-on-light.png`,
            }),
          });
        } else {
          // No Resend key configured — same no-op-and-log pattern as every
          // other email in this app (see lib/email.ts). The booking still
          // shows up next time the tutor opens Booking Links or Sessions,
          // which is the "in-app" half of "email if Resend set, otherwise
          // in-app" — there's no separate notification inbox in this MVP.
          console.log(`[booking notification] ${tutor.email}: new booking for ${studentName}`);
        }
      }

      // Confirmation to the parent — checked and rendered BEFORE claiming
      // (unlike the tutor notification above, this one is dedup-guarded):
      // claiming first and only then discovering there's no template would
      // permanently burn the one-per-session claim slot for nothing. Once
      // claimed, the send result is checked and logged — a claimed-but-
      // unsent row can't be retried (same "never double-send over always
      // eventually deliver" tradeoff as the cron job), so a silent failure
      // here would otherwise vanish with no trail anywhere.
      const template = tutor.reminder_templates?.booking_confirmation;
      if (template) {
        const { error: claimError } = await admin
          .from("reminders")
          .insert({ session_id: link.session_id, kind: "booking_confirmation", channel: "email", template_key: "booking_confirmation" });

        if (!claimError) {
          const filled = interpolateTemplate(template, { student: studentName, tutor: tutor.name, when: whenText });
          if (isEmailConfigured()) {
            const sendResult = await sendEmail({
              to: parentEmail,
              subject: filled.subject,
              html: `<p>${filled.body.replace(/\n/g, "<br/>")}</p>`,
            });
            if (sendResult.error) {
              console.error(`Booking confirmation send failed for session ${link.session_id}:`, sendResult.error);
            }
          } else {
            console.log(`[booking confirmation] ${parentEmail}: ${filled.subject}`);
          }
        }
        // A claimError here (e.g. 23505 from a retried submission) just
        // means a confirmation was already logged for this session.
      }
    }
  } catch {
    // Notification failure should never fail the parent's booking.
  }

  return { bookingLinkId: bookingLinkId ?? undefined };
}

export interface ConfirmOpenBookingResult {
  error?: string;
  sessionId?: string;
}

/**
 * Confirms an arbitrary time on a standing (open_availability) link — same
 * anon-role-via-server-action shape as confirmBookingLinkAction above, and
 * the same best-effort notification flow, just keyed off the RPC's
 * returned session_id directly (an open_availability link never sets
 * booking_links.session_id — it's reusable, not single-booking — so there's
 * no link row to read that back from).
 */
export async function confirmOpenBookingLinkAction(
  _prev: ConfirmOpenBookingResult,
  formData: FormData
): Promise<ConfirmOpenBookingResult> {
  const token = String(formData.get("token") ?? "").trim();
  const startTs = String(formData.get("start_ts") ?? "").trim();
  const parentName = String(formData.get("parent_name") ?? "").trim();
  const parentEmail = String(formData.get("parent_email") ?? "").trim();
  const studentName = String(formData.get("student_name") ?? "").trim();

  if (!token || !startTs) return { error: "Missing booking details." };
  if (!parentEmail) return { error: "Email is required." };
  if (Number.isNaN(new Date(startTs).getTime())) return { error: "Invalid time." };

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("confirm_open_booking_link", {
    p_token: token,
    p_start_ts: startTs,
    p_parent_name: (parentName || null) as unknown as string,
    p_parent_email: parentEmail,
    p_student_name: (studentName || null) as unknown as string,
  });

  if (error) return { error: error.message };
  const result = data as unknown as { session_id: string; booking_link_id: string } | null;
  const sessionId = result?.session_id;
  if (!sessionId) return { error: "Could not confirm the booking." };

  try {
    const admin = createAdminClient();
    const { data: session } = await admin
      .from("sessions")
      .select("occurred_on, start_time, client_id, tutor_id")
      .eq("id", sessionId)
      .maybeSingle();

    if (session) {
      const [{ data: tutor }, { data: student }] = await Promise.all([
        admin.from("tutors").select("name, email, reminder_templates").eq("id", session.tutor_id).maybeSingle(),
        admin.from("clients").select("student_name").eq("id", session.client_id).maybeSingle(),
      ]);

      const whenText = formatBookingWhen(`${session.occurred_on}T${session.start_time ?? "00:00:00"}.000Z`);
      const studentDisplayName = student?.student_name ?? "a student";

      if (tutor?.email) {
        if (isEmailConfigured()) {
          await sendEmail({
            to: tutor.email,
            subject: `New booking: ${studentDisplayName}`,
            html: buildBookingConfirmedEmailHtml({
              tutorName: tutor.name,
              studentName: studentDisplayName,
              parentName: parentName || null,
              whenText,
              sessionsUrl: `${appUrl()}/tutor/sessions`,
              logoUrl: `${appUrl()}/brand/logo/slate-logo-on-light.png`,
            }),
          });
        } else {
          console.log(`[booking notification] ${tutor.email}: new booking for ${studentDisplayName}`);
        }
      }

      const template = (tutor?.reminder_templates as unknown as ReminderTemplates | null)?.booking_confirmation;
      if (template) {
        const { error: claimError } = await admin
          .from("reminders")
          .insert({ session_id: sessionId, kind: "booking_confirmation", channel: "email", template_key: "booking_confirmation" });

        if (!claimError) {
          const filled = interpolateTemplate(template, { student: studentDisplayName, tutor: tutor?.name ?? "your tutor", when: whenText });
          if (isEmailConfigured()) {
            const sendResult = await sendEmail({
              to: parentEmail,
              subject: filled.subject,
              html: `<p>${filled.body.replace(/\n/g, "<br/>")}</p>`,
            });
            if (sendResult.error) {
              console.error(`Booking confirmation send failed for session ${sessionId}:`, sendResult.error);
            }
          } else {
            console.log(`[booking confirmation] ${parentEmail}: ${filled.subject}`);
          }
        }
      }
    }
  } catch {
    // Notification failure should never fail the parent's booking.
  }

  return { sessionId };
}
