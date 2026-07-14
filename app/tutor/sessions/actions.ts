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

  await requireTutor();
  const supabase = await createClient();

  const occurredOn = String(formData.get("occurred_on") ?? "");
  const startTime = String(formData.get("start_time") ?? "").trim();
  const durationMinutes = Number(formData.get("duration_minutes") ?? "0");
  const travelMinutes = Number(formData.get("travel_minutes") ?? "0");
  const location = String(formData.get("location") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!occurredOn) return { error: "Date is required." };
  if (!durationMinutes || durationMinutes <= 0) return { error: "Duration must be more than 0 minutes." };
  if (travelMinutes < 0) return { error: "Travel minutes can't be negative." };

  // update_session (SECURITY DEFINER) re-resolves the rate snapshot from
  // the client's *current* rate rule, blocks edits on a billed session, and
  // — if this session is claimed onto a draft invoice — resyncs that
  // invoice's line item + total in the same transaction.
  const { error } = await supabase.rpc("update_session", {
    p_session_id: sessionId,
    p_occurred_on: occurredOn,
    // The generated RPC arg types don't reflect that these Postgres params
    // accept null (the type generator only sees the SQL types, not that
    // the function body is fine with a null time/text) — Postgres itself
    // accepts null here without issue.
    p_start_time: (startTime || null) as unknown as string,
    p_duration_minutes: Math.round(durationMinutes),
    p_travel_minutes: Math.round(travelMinutes),
    p_location: (location || null) as unknown as string,
    p_notes: (notes || null) as unknown as string,
  });

  if (error) return { error: error.message };

  revalidatePath("/tutor/sessions");
  revalidatePath(`/tutor/sessions/${sessionId}`);
  revalidatePath("/tutor/invoices");
  revalidatePath("/tutor");
  return {};
}

export async function deleteSessionAction(sessionId: string): Promise<SessionFormResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_session", { p_session_id: sessionId });

  if (error) return { error: error.message };

  revalidatePath("/tutor/sessions");
  revalidatePath("/tutor/invoices");
  revalidatePath("/tutor");
  return {};
}
