"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import {
  resolveBillTravel,
  resolveEffectiveRateCents,
  resolveTravelRateCents,
  type RateType,
} from "@/lib/billing";

export interface SessionFormResult {
  error?: string;
}

export async function createSessionAction(
  _prev: SessionFormResult,
  formData: FormData
): Promise<SessionFormResult> {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const clientId = String(formData.get("client_id") ?? "");
  const occurredOn = String(formData.get("occurred_on") ?? "");
  const startTime = String(formData.get("start_time") ?? "").trim();
  const durationMinutes = Number(formData.get("duration_minutes") ?? "0");
  const travelMinutes = Number(formData.get("travel_minutes") ?? "0");
  const location = String(formData.get("location") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!clientId) return { error: "Pick a student." };
  if (!occurredOn) return { error: "Date is required." };
  if (!durationMinutes || durationMinutes <= 0) return { error: "Duration must be more than 0 minutes." };
  if (travelMinutes < 0) return { error: "Travel minutes can't be negative." };

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .eq("tutor_id", tutor.id)
    .maybeSingle();

  if (clientError || !client) return { error: "Student not found." };

  const effectiveRateCents = resolveEffectiveRateCents(
    client.rate_type as RateType,
    client.custom_rate_cents,
    tutor.standard_rate_cents
  );
  const billTravel = resolveBillTravel(client.bill_travel, tutor.bill_travel_default);
  const travelRateCents = billTravel
    ? resolveTravelRateCents(client.travel_rate_cents, tutor.travel_rate_cents, effectiveRateCents)
    : null;

  const { error } = await supabase.from("sessions").insert({
    tutor_id: tutor.id,
    client_id: clientId,
    occurred_on: occurredOn,
    start_time: startTime || null,
    duration_minutes: Math.round(durationMinutes),
    travel_minutes: Math.round(travelMinutes),
    location: location || null,
    bill_travel: billTravel,
    effective_rate_cents: effectiveRateCents,
    travel_rate_cents: travelRateCents,
    notes: notes || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/tutor/sessions");
  revalidatePath("/tutor");
  return {};
}

export async function updateSessionAction(
  _prev: SessionFormResult,
  formData: FormData
): Promise<SessionFormResult> {
  const sessionId = String(formData.get("id") ?? "");
  if (!sessionId) return { error: "Missing session id." };

  const tutor = await requireTutor();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("tutor_id", tutor.id)
    .maybeSingle();

  if (!existing) return { error: "Session not found." };
  if (existing.status === "billed") return { error: "This session is already billed and can't be edited." };

  const occurredOn = String(formData.get("occurred_on") ?? "");
  const startTime = String(formData.get("start_time") ?? "").trim();
  const durationMinutes = Number(formData.get("duration_minutes") ?? "0");
  const travelMinutes = Number(formData.get("travel_minutes") ?? "0");
  const location = String(formData.get("location") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!occurredOn) return { error: "Date is required." };
  if (!durationMinutes || durationMinutes <= 0) return { error: "Duration must be more than 0 minutes." };
  if (travelMinutes < 0) return { error: "Travel minutes can't be negative." };

  // Re-resolve rate snapshot from the client's *current* rate rule — editing
  // a logged session is treated as re-logging it, not preserving stale math.
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", existing.client_id)
    .single();

  const effectiveRateCents = resolveEffectiveRateCents(
    client!.rate_type as RateType,
    client!.custom_rate_cents,
    tutor.standard_rate_cents
  );
  const billTravel = resolveBillTravel(client!.bill_travel, tutor.bill_travel_default);
  const travelRateCents = billTravel
    ? resolveTravelRateCents(client!.travel_rate_cents, tutor.travel_rate_cents, effectiveRateCents)
    : null;

  const { error } = await supabase
    .from("sessions")
    .update({
      occurred_on: occurredOn,
      start_time: startTime || null,
      duration_minutes: Math.round(durationMinutes),
      travel_minutes: Math.round(travelMinutes),
      location: location || null,
      bill_travel: billTravel,
      effective_rate_cents: effectiveRateCents,
      travel_rate_cents: travelRateCents,
      notes: notes || null,
    })
    .eq("id", sessionId);

  if (error) return { error: error.message };

  revalidatePath("/tutor/sessions");
  revalidatePath("/tutor");
  return {};
}

export async function deleteSessionAction(sessionId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("sessions").delete().eq("id", sessionId).eq("status", "logged");
  revalidatePath("/tutor/sessions");
  revalidatePath("/tutor");
}
