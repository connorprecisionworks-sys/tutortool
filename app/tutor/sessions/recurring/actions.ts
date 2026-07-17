"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { generateRecurringInstances } from "@/lib/recurring-sessions";

export interface RecurringSessionFormResult {
  error?: string;
  recurringSessionId?: string;
}

export async function createRecurringSessionAction(
  _prev: RecurringSessionFormResult,
  formData: FormData
): Promise<RecurringSessionFormResult> {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const clientId = String(formData.get("client_id") ?? "");
  const serviceId = String(formData.get("service_id") ?? "").trim() || null;
  const weekday = Number(formData.get("weekday") ?? "-1");
  const startTime = String(formData.get("start_time") ?? "").trim();
  const durationMinutes = Number(formData.get("duration_minutes") ?? "0");
  const travelMinutes = Number(formData.get("travel_minutes") ?? "0");
  const location = String(formData.get("location") ?? "").trim() || null;
  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "").trim() || null;

  if (!clientId) return { error: "Pick a student." };
  if (Number.isNaN(weekday) || weekday < 0 || weekday > 6) return { error: "Pick a day of the week." };
  if (!startTime) return { error: "Pick a start time." };
  if (!durationMinutes || durationMinutes <= 0) return { error: "Duration must be more than 0 minutes." };
  if (travelMinutes < 0) return { error: "Travel minutes can't be negative." };
  if (!startDate) return { error: "Pick a start date." };
  if (endDate && endDate < startDate) return { error: "End date must be on or after the start date." };

  const { data: series, error } = await supabase
    .from("recurring_sessions")
    .insert({
      tutor_id: tutor.id,
      client_id: clientId,
      service_id: serviceId,
      weekday: Math.round(weekday),
      start_time: startTime,
      duration_minutes: Math.round(durationMinutes),
      travel_minutes: Math.round(travelMinutes),
      location,
      start_date: startDate,
      end_date: endDate,
    })
    .select("*")
    .single();

  if (error || !series) return { error: error?.message ?? "Could not create the recurring session." };

  try {
    await generateRecurringInstances(supabase, series);
  } catch (genError) {
    // The template exists even if the first batch generation hit an issue —
    // surface it rather than silently leaving an empty series with no
    // upcoming instances and no explanation.
    const message = genError instanceof Error ? genError.message : "Could not generate upcoming sessions.";
    return { error: message, recurringSessionId: series.id };
  }

  revalidatePath("/tutor/sessions");
  revalidatePath("/tutor/sessions/recurring");
  revalidatePath("/tutor");
  return { recurringSessionId: series.id };
}

export interface EndSeriesResult {
  error?: string;
  cancelled?: number;
  skipped?: number;
}

/**
 * "This and future" cancellation — stops generation from p_from_date
 * forward and cancels every not-yet-cancelled generated instance on or
 * after it via the normal Q4 cancel_session flow (see
 * end_recurring_series in the B2 migration). fromDate defaults to today
 * when ending a series from its management page; the per-session "cancel
 * this + future" entry point passes that session's own occurred_on instead.
 */
export async function endRecurringSeriesAction(
  recurringSessionId: string,
  fromDate: string,
  overrideHandling: string | null
): Promise<EndSeriesResult> {
  await requireTutor();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("end_recurring_series", {
    p_recurring_session_id: recurringSessionId,
    p_from_date: fromDate,
    // The generated RPC arg type doesn't reflect that this Postgres param
    // accepts null (the type generator only sees the SQL `default null`,
    // not that a caller can pass null explicitly) — Postgres itself accepts
    // it without issue, same as every other optional-override RPC call.
    p_override_handling: overrideHandling as unknown as string,
  });

  revalidatePath("/tutor/sessions");
  revalidatePath("/tutor/sessions/recurring");
  revalidatePath("/tutor");

  if (error) return { error: error.message };
  const result = data as { cancelled: number; skipped: number } | null;
  return { cancelled: result?.cancelled ?? 0, skipped: result?.skipped ?? 0 };
}
