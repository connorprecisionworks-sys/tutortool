"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { buildBookingConfirmedEmailHtml } from "@/lib/booking-link-email";
import { formatBookingWhen } from "@/lib/scheduling";
import { appUrl } from "@/lib/env";

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

  // Best-effort tutor notification — never block the parent's confirmation
  // on it. Needs the admin client since, same as above, there's no user
  // session here to read the tutor's row through RLS (matches the existing
  // "invite redemption that must bypass RLS deliberately" precedent
  // documented on lib/supabase/admin.ts).
  try {
    const admin = createAdminClient();
    const { data: link } = await admin
      .from("booking_links")
      .select("tutor_id, session_id, tutors(name, email), clients(student_name)")
      .eq("id", bookingLinkId)
      .maybeSingle();

    const tutor = link?.tutors as unknown as { name: string; email: string } | null;
    const student = link?.clients as unknown as { student_name: string } | null;

    if (tutor?.email && link?.session_id) {
      const { data: session } = await admin
        .from("sessions")
        .select("occurred_on, start_time")
        .eq("id", link.session_id)
        .maybeSingle();

      const whenText = session
        ? formatBookingWhen(`${session.occurred_on}T${session.start_time ?? "00:00:00"}.000Z`)
        : "the booked time";

      if (isEmailConfigured()) {
        await sendEmail({
          to: tutor.email,
          subject: `New booking: ${student?.student_name ?? "a student"}`,
          html: buildBookingConfirmedEmailHtml({
            tutorName: tutor.name,
            studentName: student?.student_name ?? "a student",
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
        console.log(`[booking notification] ${tutor.email}: new booking for ${student?.student_name}`);
      }
    }
  } catch {
    // Notification failure should never fail the parent's booking.
  }

  return { bookingLinkId: bookingLinkId ?? undefined };
}
