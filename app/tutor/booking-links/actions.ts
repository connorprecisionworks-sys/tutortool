"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { getPostHogClient } from "@/lib/posthog-server";

export interface BookingLinkFormResult {
  error?: string;
  token?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export async function createBookingLinkAction(
  _prev: BookingLinkFormResult,
  formData: FormData
): Promise<BookingLinkFormResult> {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const studentId = String(formData.get("student_id") ?? "").trim();
  const serviceId = String(formData.get("service_id") ?? "").trim();
  const durationRaw = String(formData.get("duration_minutes") ?? "").trim();

  // Slots arrive as parallel slot_date[]/slot_time[] entries — see
  // components/booking-links/booking-link-form.tsx, which lets the tutor
  // add/remove rows dynamically. Same wall-clock-stamped-as-UTC convention
  // as the rest of scheduling (see app/parent/schedule/actions.ts).
  const dates = formData.getAll("slot_date").map(String);
  const times = formData.getAll("slot_time").map(String);
  if (dates.length !== times.length || dates.length === 0) {
    return { error: "Offer at least one time slot." };
  }

  const slotStarts: string[] = [];
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const time = times[i];
    if (!date && !time) continue; // a blank trailing row from the UI
    if (!DATE_RE.test(date) || !TIME_RE.test(time)) {
      return { error: "Every slot needs a valid date and time." };
    }
    const iso = `${date}T${time}:00.000Z`;
    if (Number.isNaN(new Date(iso).getTime())) return { error: "Invalid date or time in a slot." };
    slotStarts.push(iso);
  }
  if (slotStarts.length === 0) return { error: "Offer at least one time slot." };

  const durationMinutes = durationRaw ? Number(durationRaw) : null;
  if (!serviceId && (!durationMinutes || durationMinutes <= 0)) {
    return { error: "Pick a service or set a session duration." };
  }

  // The generated RPC arg types don't reflect that student_id/service_id/
  // duration_minutes accept null (the type generator only sees the SQL
  // types, not that the function body is fine with null) — Postgres itself
  // accepts null here without issue.
  const { data: token, error } = await supabase.rpc("create_booking_link", {
    p_student_id: (studentId || null) as unknown as string,
    p_service_id: (serviceId || null) as unknown as string,
    p_duration_minutes: (durationMinutes ?? null) as unknown as number,
    p_slot_starts: slotStarts,
  });

  if (error) return { error: error.message };

  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: tutor.auth_user_id,
    event: "booking_link_created",
    properties: { slot_count: slotStarts.length, has_service: Boolean(serviceId), has_student: Boolean(studentId) },
  });
  await posthog.flush();

  revalidatePath("/tutor/booking-links");
  return { token: token ?? undefined };
}

export async function createOpenAvailabilityBookingLinkAction(
  _prev: BookingLinkFormResult,
  formData: FormData
): Promise<BookingLinkFormResult> {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const studentId = String(formData.get("student_id") ?? "").trim();
  const serviceId = String(formData.get("service_id") ?? "").trim();
  const durationRaw = String(formData.get("duration_minutes") ?? "").trim();
  const bufferRaw = String(formData.get("buffer_minutes") ?? "0").trim();

  const durationMinutes = durationRaw ? Number(durationRaw) : null;
  if (!serviceId && (!durationMinutes || durationMinutes <= 0)) {
    return { error: "Pick a service or set a session duration." };
  }

  const bufferMinutes = Number(bufferRaw);
  if (Number.isNaN(bufferMinutes) || bufferMinutes < 0) {
    return { error: "Buffer must be zero or a positive number of minutes." };
  }

  const { data: token, error } = await supabase.rpc("create_open_availability_booking_link", {
    p_student_id: (studentId || null) as unknown as string,
    p_service_id: (serviceId || null) as unknown as string,
    p_duration_minutes: (durationMinutes ?? null) as unknown as number,
    p_buffer_minutes: Math.round(bufferMinutes),
  });

  if (error) return { error: error.message };

  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: tutor.auth_user_id,
    event: "open_availability_booking_link_created",
    properties: { has_service: Boolean(serviceId), has_student: Boolean(studentId), buffer_minutes: bufferMinutes },
  });
  await posthog.flush();

  revalidatePath("/tutor/booking-links");
  return { token: token ?? undefined };
}

export interface CancelBookingLinkResult {
  error?: string;
}

export async function cancelBookingLinkAction(bookingLinkId: string): Promise<CancelBookingLinkResult> {
  await requireTutor();
  const supabase = await createClient();

  const { error } = await supabase.rpc("cancel_booking_link", { p_booking_link_id: bookingLinkId });

  revalidatePath("/tutor/booking-links");
  if (error) return { error: error.message };
  return {};
}
