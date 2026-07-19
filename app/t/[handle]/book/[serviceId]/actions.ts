"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { buildBookingConfirmedEmailHtml } from "@/lib/booking-link-email";
import { formatBookingWhen } from "@/lib/scheduling";
import { appUrl } from "@/lib/env";
import type { ReminderTemplates } from "@/lib/reminders";
import { resolveSystemTemplate, renderTemplateEmailHtml } from "@/lib/email-templates";
import { parentFacingIdentity } from "@/lib/email-identity";
import { isNotificationEnabled, type NotificationSettings } from "@/lib/notification-settings";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface PublicServiceSlotsResult {
  slots: string[];
  error?: string;
}

/**
 * Same "anon RPC through a server action" shape as the B4 booking-link
 * actions — the visitor has no session, and every anonymous read/write in
 * this app goes through one path rather than a second, browser-side call.
 */
export async function getPublicServiceSlotsAction(
  handle: string,
  serviceId: string,
  date: string
): Promise<PublicServiceSlotsResult> {
  if (!DATE_RE.test(date)) return { slots: [], error: "Invalid date." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_service_slots", {
    p_handle: handle,
    p_service_id: serviceId,
    p_date: date,
  });

  if (error) return { slots: [], error: error.message };
  const result = data as unknown as { slots: string[] } | null;
  return { slots: result?.slots ?? [] };
}

export interface ConfirmPublicServiceBookingResult {
  error?: string;
  sessionId?: string;
}

/**
 * Confirms an availability-driven booking for a specific service directly
 * off the public tutor page — no booking_links token involved (see the C3
 * migration's header comment for why). Mirrors confirmOpenBookingLinkAction's
 * best-effort tutor-notification + parent-confirmation email flow.
 */
export async function confirmPublicServiceBookingAction(
  _prev: ConfirmPublicServiceBookingResult,
  formData: FormData
): Promise<ConfirmPublicServiceBookingResult> {
  const handle = String(formData.get("handle") ?? "").trim();
  const serviceId = String(formData.get("service_id") ?? "").trim();
  const startTs = String(formData.get("start_ts") ?? "").trim();
  const parentName = String(formData.get("parent_name") ?? "").trim();
  const parentEmail = String(formData.get("parent_email") ?? "").trim();
  const studentName = String(formData.get("student_name") ?? "").trim();

  if (!handle || !serviceId || !startTs) return { error: "Missing booking details." };
  if (!parentEmail) return { error: "Email is required." };
  if (!studentName) return { error: "Student name is required." };
  if (Number.isNaN(new Date(startTs).getTime())) return { error: "Invalid time." };

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("confirm_public_service_booking", {
    p_handle: handle,
    p_service_id: serviceId,
    p_start_ts: startTs,
    p_parent_name: (parentName || null) as unknown as string,
    p_parent_email: parentEmail,
    p_student_name: studentName,
  });

  if (error) return { error: error.message };
  const result = data as unknown as { session_id: string } | null;
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
        admin
          .from("tutors")
          .select("name, email, reminder_templates, notification_settings")
          .eq("id", session.tutor_id)
          .maybeSingle(),
        admin.from("clients").select("student_name").eq("id", session.client_id).maybeSingle(),
      ]);

      const whenText = formatBookingWhen(`${session.occurred_on}T${session.start_time ?? "00:00:00"}.000Z`);
      const studentDisplayName = student?.student_name ?? "a student";
      const notificationSettings = tutor?.notification_settings as unknown as NotificationSettings | null;
      const bookingLink = `${appUrl()}/t/${handle}`;

      if (tutor?.email && isNotificationEnabled(notificationSettings, "tutor_new_booking")) {
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

      if (tutor && isNotificationEnabled(notificationSettings, "parent_booking_confirmation")) {
        const template = resolveSystemTemplate(tutor.reminder_templates as unknown as ReminderTemplates, "booking_confirmation");
        const { error: claimError } = await admin
          .from("reminders")
          .insert({ session_id: sessionId, kind: "booking_confirmation", channel: "email", template_key: "booking_confirmation" });

        if (!claimError) {
          const rendered = renderTemplateEmailHtml(
            template,
            { student: studentDisplayName, tutor: tutor.name, when: whenText, link: bookingLink },
            { ctaLabel: "View booking", logoUrl: `${appUrl()}/brand/logo/slate-logo-on-light.png` }
          );
          if (isEmailConfigured()) {
            const sendResult = await sendEmail({
              to: parentEmail,
              subject: rendered.subject,
              html: rendered.html,
              ...parentFacingIdentity(tutor),
            });
            if (sendResult.error) {
              console.error(`Booking confirmation send failed for session ${sessionId}:`, sendResult.error);
            }
          } else {
            console.log(`[booking confirmation] ${parentEmail}: ${rendered.subject}`);
          }
        }
      }
    }
  } catch {
    // Notification failure should never fail the parent's booking.
  }

  return { sessionId };
}
