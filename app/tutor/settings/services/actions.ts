"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { dollarsToCents } from "@/lib/money";

export interface ServiceFormResult {
  error?: string;
}

interface ParsedServiceForm {
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
}

// Shared with the E4 inline-edit actions below (updateServicePriceAction /
// updateServiceDurationMinutesAction) so the single-column inline editors on
// the Services list validate identically to a full form submit — same error
// text, same non-negative/rounding rules, no drift between the two paths.
function validateDurationMinutes(durationMinutes: number): string | null {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return "Duration must be more than 0 minutes.";
  }
  return null;
}

function validatePriceCents(priceCents: number): string | null {
  if (!Number.isFinite(priceCents) || priceCents < 0) {
    return "Price must be a positive number.";
  }
  return null;
}

function parseServiceForm(formData: FormData): ParsedServiceForm | { error: string } {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Service name is required." };

  const durationMinutes = Number(formData.get("duration_minutes") ?? "0");
  const durationError = validateDurationMinutes(durationMinutes);
  if (durationError) return { error: durationError };

  const priceDollars = Number(formData.get("price_cents") ?? "0");
  if (Number.isNaN(priceDollars)) return { error: "Price must be a positive number." };
  const priceCents = dollarsToCents(priceDollars);
  const priceError = validatePriceCents(priceCents);
  if (priceError) return { error: priceError };

  const description = String(formData.get("description") ?? "").trim();

  return {
    name,
    description: description || null,
    durationMinutes: Math.round(durationMinutes),
    priceCents,
  };
}

export async function createServiceAction(
  _prev: ServiceFormResult,
  formData: FormData
): Promise<ServiceFormResult> {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const parsed = parseServiceForm(formData);
  if ("error" in parsed) return parsed;

  const { error } = await supabase.from("services").insert({
    tutor_id: tutor.id,
    name: parsed.name,
    description: parsed.description,
    duration_minutes: parsed.durationMinutes,
    price_cents: parsed.priceCents,
    is_active: true,
  });

  if (error) return { error: error.message };

  revalidatePath("/tutor/settings/services");
  return {};
}

export async function updateServiceAction(
  _prev: ServiceFormResult,
  formData: FormData
): Promise<ServiceFormResult> {
  const serviceId = String(formData.get("id") ?? "");
  if (!serviceId) return { error: "Missing service id." };

  const tutor = await requireTutor();
  const supabase = await createClient();

  const parsed = parseServiceForm(formData);
  if ("error" in parsed) return parsed;

  const { error } = await supabase
    .from("services")
    .update({
      name: parsed.name,
      description: parsed.description,
      duration_minutes: parsed.durationMinutes,
      price_cents: parsed.priceCents,
    })
    .eq("id", serviceId)
    .eq("tutor_id", tutor.id);

  if (error) return { error: error.message };

  revalidatePath("/tutor/settings/services");
  return {};
}

export interface UpdateServiceFieldResult {
  error?: string;
}

/**
 * E4 (build-queue.md) — inline Price editor on the Services list. Plain
 * tutor-owned-column update through RLS (same shape updateServiceAction
 * already uses for the full form), not a SECURITY DEFINER money
 * state-machine function — price_cents on `services` only feeds new
 * sessions logged against it going forward; existing sessions/invoices
 * already snapshotted their own amount at log time (see lib/billing.ts).
 */
export async function updateServicePriceAction(
  serviceId: string,
  priceCents: number
): Promise<UpdateServiceFieldResult> {
  const error = validatePriceCents(priceCents);
  if (error) return { error };

  const tutor = await requireTutor();
  const supabase = await createClient();

  const { error: dbError } = await supabase
    .from("services")
    .update({ price_cents: Math.round(priceCents) })
    .eq("id", serviceId)
    .eq("tutor_id", tutor.id);

  if (dbError) return { error: dbError.message };

  revalidatePath("/tutor/settings/services");
  return {};
}

/** E4 — inline Duration editor, same shape as updateServicePriceAction above. */
export async function updateServiceDurationMinutesAction(
  serviceId: string,
  durationMinutes: number
): Promise<UpdateServiceFieldResult> {
  const error = validateDurationMinutes(durationMinutes);
  if (error) return { error };

  const tutor = await requireTutor();
  const supabase = await createClient();

  const { error: dbError } = await supabase
    .from("services")
    .update({ duration_minutes: Math.round(durationMinutes) })
    .eq("id", serviceId)
    .eq("tutor_id", tutor.id);

  if (dbError) return { error: dbError.message };

  revalidatePath("/tutor/settings/services");
  return {};
}

export async function setServiceActiveAction(serviceId: string, isActive: boolean): Promise<void> {
  const tutor = await requireTutor();
  const supabase = await createClient();
  await supabase.from("services").update({ is_active: isActive }).eq("id", serviceId).eq("tutor_id", tutor.id);
  revalidatePath("/tutor/settings/services");
}

export interface MoveServiceResult {
  error?: string;
}

/**
 * C4: reorders how services appear on the public page. move_service
 * (SECURITY DEFINER) does the whole read-swap-renumber-write cycle in one
 * transaction server-side — a code review of the original JS version (a
 * sequential per-row update loop with no transaction) found it could leave
 * a corrupted, partially-renumbered order behind if any single update in
 * the loop failed. New services get their sort_order auto-assigned by a
 * DB trigger (always current-max-plus-one for the tutor), so they append
 * at the end rather than tying at the column default of 0.
 */
export async function moveServiceAction(serviceId: string, direction: "up" | "down"): Promise<MoveServiceResult> {
  await requireTutor();
  const supabase = await createClient();

  const { error } = await supabase.rpc("move_service", { p_service_id: serviceId, p_direction: direction });
  if (error) return { error: error.message };

  revalidatePath("/tutor/settings/services");
  return {};
}

export interface DeleteServiceResult {
  error?: string;
}

export async function deleteServiceAction(serviceId: string): Promise<DeleteServiceResult> {
  await requireTutor();
  const supabase = await createClient();
  // delete_service (SECURITY DEFINER) blocks the delete if any session or
  // pending booking references this service — deleting would otherwise
  // silently strip its price off a not-yet-approved booking (the
  // sessions/bookings FKs are `on delete set null`) or erase historical
  // attribution on past sessions. Deactivating (setServiceActiveAction) is
  // always safe and is what the delete error steers a tutor toward.
  const { error } = await supabase.rpc("delete_service", { p_service_id: serviceId });

  revalidatePath("/tutor/settings/services");
  if (error) return { error: error.message };
  return {};
}
