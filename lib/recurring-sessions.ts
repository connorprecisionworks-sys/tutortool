import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/database.types";
import { resolveEffectiveRateCents, resolveBillTravel, resolveTravelRateCents, type RateType } from "@/lib/billing";

export const RECURRING_SESSION_HORIZON_WEEKS = 8;

export const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type RecurringSession = Tables<"recurring_sessions">;

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseIsoDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function firstOccurrenceOnOrAfter(from: Date, weekday: number): Date {
  const d = new Date(from);
  const delta = (weekday - d.getUTCDay() + 7) % 7;
  d.setUTCDate(d.getUTCDate() + delta);
  return d;
}

/**
 * Generates any missing `sessions` rows for a recurring series between
 * "today" (or the series start, if later) and the horizon, skipping dates
 * that already have an instance. Safe to call repeatedly — used both for a
 * series' initial batch (right after creation, on the authenticated
 * client) and by the daily cron rolling the horizon forward for every
 * active series (on the admin client, bypassing RLS since it isn't tied to
 * one tutor's session). Mirrors createSessionAction's rate-resolution
 * exactly so a generated instance bills identically to a manually-logged
 * one — kept as one shared implementation rather than duplicated in SQL so
 * the two can never drift apart.
 */
export async function generateRecurringInstances(
  supabase: SupabaseClient<Database>,
  series: RecurringSession,
  horizonWeeks: number = RECURRING_SESSION_HORIZON_WEEKS
): Promise<{ created: number }> {
  if (series.status !== "active") return { created: 0 };

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const horizonEnd = new Date(today);
  horizonEnd.setUTCDate(horizonEnd.getUTCDate() + horizonWeeks * 7);

  const seriesStart = parseIsoDate(series.start_date);
  const rangeStart = seriesStart > today ? seriesStart : today;
  const seriesEnd = series.end_date ? parseIsoDate(series.end_date) : null;
  const effectiveEnd = seriesEnd && seriesEnd < horizonEnd ? seriesEnd : horizonEnd;

  if (rangeStart > effectiveEnd) return { created: 0 };

  const firstOccurrence = firstOccurrenceOnOrAfter(rangeStart, series.weekday);
  if (firstOccurrence > effectiveEnd) return { created: 0 };

  const { data: existing, error: existingError } = await supabase
    .from("sessions")
    .select("occurred_on")
    .eq("recurring_session_id", series.id)
    .gte("occurred_on", toIsoDate(firstOccurrence))
    .lte("occurred_on", toIsoDate(effectiveEnd));
  if (existingError) throw new Error(existingError.message);
  const existingDates = new Set((existing ?? []).map((s) => s.occurred_on));

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", series.client_id)
    .single();
  if (clientError || !client) throw new Error(clientError?.message ?? "Student not found.");

  const { data: tutor, error: tutorError } = await supabase
    .from("tutors")
    .select("*")
    .eq("id", series.tutor_id)
    .single();
  if (tutorError || !tutor) throw new Error(tutorError?.message ?? "Tutor not found.");

  let servicePriceCents: number | null = null;
  if (series.service_id) {
    const { data: service } = await supabase
      .from("services")
      .select("price_cents, is_active")
      .eq("id", series.service_id)
      .maybeSingle();
    // A service later deactivated mid-series: fall back to hourly rate math
    // for new instances rather than blocking generation entirely, same
    // "no dead ends" reasoning as Q2's deactivated-service-still-billable fix.
    servicePriceCents = service?.is_active ? service.price_cents : null;
  }

  const effectiveRateCents = resolveEffectiveRateCents(
    client.rate_type as RateType,
    client.custom_rate_cents,
    tutor.standard_rate_cents
  );
  const billTravel = resolveBillTravel(client.bill_travel, tutor.bill_travel_default);
  const travelRateCents = billTravel
    ? resolveTravelRateCents(client.travel_rate_cents, tutor.travel_rate_cents, effectiveRateCents)
    : null;

  const rows: Database["public"]["Tables"]["sessions"]["Insert"][] = [];
  for (let d = new Date(firstOccurrence); d <= effectiveEnd; d.setUTCDate(d.getUTCDate() + 7)) {
    const iso = toIsoDate(d);
    if (existingDates.has(iso)) continue;
    rows.push({
      tutor_id: series.tutor_id,
      client_id: series.client_id,
      service_id: series.service_id,
      service_price_cents: servicePriceCents,
      occurred_on: iso,
      start_time: series.start_time,
      duration_minutes: series.duration_minutes,
      travel_minutes: series.travel_minutes,
      location: series.location,
      bill_travel: billTravel,
      effective_rate_cents: effectiveRateCents,
      travel_rate_cents: travelRateCents,
      recurring_session_id: series.id,
    });
  }

  if (rows.length === 0) return { created: 0 };

  const { error: insertError } = await supabase.from("sessions").insert(rows);
  if (insertError) {
    // 23505: the unique (recurring_session_id, occurred_on) index caught a
    // race with a concurrent generation pass (e.g. the daily cron firing
    // mid-creation) — fall back to inserting one at a time so the rows that
    // don't conflict still land instead of the whole batch failing.
    if (insertError.code === "23505") {
      let created = 0;
      for (const row of rows) {
        const { error } = await supabase.from("sessions").insert(row);
        if (!error) created++;
        else if (error.code !== "23505") throw new Error(error.message);
      }
      return { created };
    }
    throw new Error(insertError.message);
  }

  return { created: rows.length };
}
