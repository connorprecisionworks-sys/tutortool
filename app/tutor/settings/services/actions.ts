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

function parseServiceForm(formData: FormData): ParsedServiceForm | { error: string } {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Service name is required." };

  const durationMinutes = Number(formData.get("duration_minutes") ?? "0");
  if (!durationMinutes || durationMinutes <= 0) return { error: "Duration must be more than 0 minutes." };

  const priceDollars = Number(formData.get("price_cents") ?? "0");
  if (Number.isNaN(priceDollars) || priceDollars < 0) return { error: "Price must be a positive number." };

  const description = String(formData.get("description") ?? "").trim();

  return {
    name,
    description: description || null,
    durationMinutes: Math.round(durationMinutes),
    priceCents: dollarsToCents(priceDollars),
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
