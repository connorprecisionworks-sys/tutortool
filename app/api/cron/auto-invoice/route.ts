import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AUTO_INVOICE_WEEKLY_CADENCE_DAYS, claimAndRunAutoInvoice } from "@/lib/auto-invoice";

// Same CRON_SECRET auth pattern as /api/cron/reminders and
// /api/cron/generate-recurring-sessions.
export async function GET(request: NextRequest): Promise<NextResponse> {
  return runAutoInvoiceJob(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return runAutoInvoiceJob(request);
}

/** Adds `days` to a YYYY-MM-DD date string, UTC, no time-of-day drift. */
function addDays(dateStr: string, days: number): string {
  const ms = new Date(`${dateStr}T00:00:00Z`).getTime() + days * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

// Bounds how many missed weekly cycles a single client catches up on in one
// run (e.g. after a long cron outage) — generating 8 back-to-back invoices
// for one client in one run is already a lot; beyond that, catching up
// silently would risk surprising a tutor with a wall of auto-sent invoices.
const MAX_CATCHUP_CYCLES = 8;

async function runAutoInvoiceJob(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Cron not configured." }, { status: 501 });
  }

  const authHeader = request.headers.get("authorization");
  const querySecret = request.nextUrl.searchParams.get("secret");
  const provided = authHeader?.replace(/^Bearer\s+/i, "") ?? querySecret;

  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: dueClients, error } = await admin
    .from("clients")
    .select("id, auto_invoice_next_date")
    .eq("auto_invoice_enabled", true)
    .eq("auto_invoice_trigger", "weekly")
    .eq("archived", false)
    .not("auto_invoice_next_date", "is", null)
    .lte("auto_invoice_next_date", today);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let clientsProcessed = 0;
  let invoicesGenerated = 0;
  let cyclesSkippedNoUnbilled = 0;

  for (const client of dueClients ?? []) {
    let nextDate = client.auto_invoice_next_date as string;
    let cycles = 0;

    while (nextDate <= today && cycles < MAX_CATCHUP_CYCLES) {
      const outcome = await claimAndRunAutoInvoice(admin, client.id, `weekly:${nextDate}`);
      if (outcome.invoiceId) invoicesGenerated += 1;
      else if (outcome.claimed) cyclesSkippedNoUnbilled += 1;

      nextDate = addDays(nextDate, AUTO_INVOICE_WEEKLY_CADENCE_DAYS);
      cycles += 1;
    }

    await admin.from("clients").update({ auto_invoice_next_date: nextDate }).eq("id", client.id);
    clientsProcessed += 1;
  }

  return NextResponse.json({
    clientsDue: dueClients?.length ?? 0,
    clientsProcessed,
    invoicesGenerated,
    cyclesSkippedNoUnbilled,
  });
}
