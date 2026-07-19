"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";

export interface AvailabilityFormResult {
  error?: string;
}

export async function addAvailabilityAction(
  _prev: AvailabilityFormResult,
  formData: FormData
): Promise<AvailabilityFormResult> {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const weekdays = formData
    .getAll("weekday")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  const startTime = String(formData.get("start_time") ?? "");
  const endTime = String(formData.get("end_time") ?? "");

  if (weekdays.length === 0) return { error: "Pick at least one day." };
  if (!startTime || !endTime) return { error: "Pick a start and end time." };
  if (startTime >= endTime) return { error: "End time must be after start time." };

  // De-dupe against windows already saved for a picked day at the exact
  // same start/end, so re-applying "Mon-Fri 3-6pm" over an existing Monday
  // window doesn't create a redundant duplicate row.
  const { data: existing } = await supabase
    .from("availability")
    .select("weekday, start_time, end_time")
    .eq("tutor_id", tutor.id)
    .in("weekday", weekdays);

  const rows = weekdays
    .filter(
      (weekday) =>
        !(existing ?? []).some(
          (e) => e.weekday === weekday && e.start_time === `${startTime}:00` && e.end_time === `${endTime}:00`
        )
    )
    .map((weekday) => ({ tutor_id: tutor.id, weekday, start_time: startTime, end_time: endTime }));

  if (rows.length === 0) return {};

  const { error } = await supabase.from("availability").insert(rows);

  if (error) return { error: error.message };

  revalidatePath("/tutor/schedule");
  revalidatePath("/tutor/onboarding");
  return {};
}

export async function removeAvailabilityAction(availabilityId: string): Promise<{ error?: string }> {
  await requireTutor();
  const supabase = await createClient();

  const { error } = await supabase.from("availability").delete().eq("id", availabilityId);
  if (error) return { error: error.message };

  revalidatePath("/tutor/schedule");
  return {};
}

export interface AvailabilityBlockFormResult {
  error?: string;
}

export async function addAvailabilityBlockAction(
  _prev: AvailabilityBlockFormResult,
  formData: FormData
): Promise<AvailabilityBlockFormResult> {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "").trim() || startDate;
  const note = String(formData.get("note") ?? "").trim();

  if (!startDate) return { error: "Pick a start date." };
  if (endDate < startDate) return { error: "End date must be on or after the start date." };

  const { error } = await supabase.from("availability_blocks").insert({
    tutor_id: tutor.id,
    start_date: startDate,
    end_date: endDate,
    note: note || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/tutor/schedule");
  return {};
}

export async function removeAvailabilityBlockAction(blockId: string): Promise<{ error?: string }> {
  await requireTutor();
  const supabase = await createClient();

  const { error } = await supabase.from("availability_blocks").delete().eq("id", blockId);
  if (error) return { error: error.message };

  revalidatePath("/tutor/schedule");
  return {};
}

export async function approveBookingAction(bookingId: string): Promise<{ error?: string }> {
  await requireTutor();
  const supabase = await createClient();

  const { error } = await supabase.rpc("approve_booking", { p_booking_id: bookingId });
  revalidatePath("/tutor/schedule");
  revalidatePath("/tutor/sessions");
  if (error) return { error: error.message };
  return {};
}

export async function declineBookingAction(bookingId: string): Promise<{ error?: string }> {
  await requireTutor();
  const supabase = await createClient();

  const { error } = await supabase.rpc("decline_booking", { p_booking_id: bookingId });
  revalidatePath("/tutor/schedule");
  if (error) return { error: error.message };
  return {};
}

export async function cancelBookingAction(bookingId: string): Promise<{ error?: string }> {
  await requireTutor();
  const supabase = await createClient();

  const { error } = await supabase.rpc("cancel_booking", { p_booking_id: bookingId });
  revalidatePath("/tutor/schedule");
  if (error) return { error: error.message };
  return {};
}
