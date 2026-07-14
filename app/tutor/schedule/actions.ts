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

  const weekday = Number(formData.get("weekday") ?? "-1");
  const startTime = String(formData.get("start_time") ?? "");
  const endTime = String(formData.get("end_time") ?? "");

  if (weekday < 0 || weekday > 6) return { error: "Pick a day." };
  if (!startTime || !endTime) return { error: "Pick a start and end time." };
  if (startTime >= endTime) return { error: "End time must be after start time." };

  const { error } = await supabase.from("availability").insert({
    tutor_id: tutor.id,
    weekday,
    start_time: startTime,
    end_time: endTime,
  });

  if (error) return { error: error.message };

  revalidatePath("/tutor/schedule");
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
