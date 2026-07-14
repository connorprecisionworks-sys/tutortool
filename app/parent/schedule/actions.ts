"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireParent } from "@/lib/auth/parent";

export interface BookingFormResult {
  error?: string;
}

// TODO(connor): no per-tutor timezone is stored yet, so there's one implicit
// wall-clock convention shared by everyone — the date/time typed into this
// form and the start_time/end_time typed into the tutor's availability form
// are both treated as literal clock values with no timezone attached, and
// stored as UTC (Postgres's session timezone here, confirmed via
// current_setting('TIMEZONE')) without conversion. Building the timestamp
// via `new Date(...).toISOString()` would instead run the input through the
// SERVER PROCESS's local timezone before converting to UTC — e.g. a parent
// on a server running America/New_York entering "4:00 PM" would be stored
// as 20:00 UTC, which then fails create_booking's availability check against
// a window that was typed and stored as literal "15:00–18:00". Appending
// "Z" directly sidesteps that conversion so the wall-clock value round-trips
// unchanged. Fine for a single-timezone MVP; revisit if tutors/parents span
// timezones (would need a stored per-tutor IANA zone and real conversion).
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export async function createBookingAction(
  _prev: BookingFormResult,
  formData: FormData
): Promise<BookingFormResult> {
  await requireParent();
  const supabase = await createClient();

  const studentId = String(formData.get("student_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const durationMinutes = Number(formData.get("duration_minutes") ?? "0");

  if (!studentId) return { error: "Missing student." };
  if (!DATE_RE.test(date) || !TIME_RE.test(time)) return { error: "Pick a date and time." };
  if (!durationMinutes || durationMinutes <= 0) return { error: "Pick a duration." };

  const requestedStartIso = `${date}T${time}:00.000Z`;
  if (Number.isNaN(new Date(requestedStartIso).getTime())) {
    return { error: "Invalid date or time." };
  }

  const { error } = await supabase.rpc("create_booking", {
    p_student_id: studentId,
    p_requested_start: requestedStartIso,
    p_duration_minutes: durationMinutes,
  });

  if (error) return { error: error.message };

  revalidatePath("/parent/schedule");
  return {};
}
