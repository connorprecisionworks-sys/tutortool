import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { formatCents } from "@/lib/money";
import {
  DEFAULT_OFFSETS_DAYS,
  daysBetween,
  interpolateTemplate,
  latestApplicableOffset,
  offsetKey,
  type ReminderTemplates,
} from "@/lib/reminders";

export const runtime = "nodejs";

/**
 * Daily reminder job. vercel.json already has a cron entry pointing here
 * (0 13 * * * — 1pm UTC daily); it only activates once this is deployed on
 * Vercel with a CRON_SECRET env var set. Vercel automatically sends
 * `Authorization: Bearer $CRON_SECRET` on cron-triggered requests when the
 * env var is named exactly CRON_SECRET (already stubbed in .env.local) —
 * no secret needs to live in vercel.json. A `?secret=` query param works
 * too, for manual/local testing with curl.
 *
 * Two responsibilities per run: (1) flip any sent invoice whose due_date
 * has passed to overdue, (2) for every sent/overdue invoice, check the
 * tutor's reminder_cadence offsets against days-past-due and send the next
 * unsent reminder in the sequence, logging it so it's never resent.
 */
// Vercel Cron triggers with a GET request; POST is kept too for convenient
// manual/local testing with a body-carrying client. Both run the same job.
export async function GET(request: NextRequest): Promise<NextResponse> {
  return runReminderJob(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return runReminderJob(request);
}

async function runReminderJob(request: NextRequest): Promise<NextResponse> {
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

  const { data: flipped } = await admin
    .from("invoices")
    .update({ status: "overdue" })
    .eq("status", "sent")
    .lt("due_date", today)
    .select("id");

  const { data: invoices } = await admin
    .from("invoices")
    .select("id, due_date, total_cents, stripe_payment_url, tutor_id, tutors(reminder_cadence, reminder_templates, name), clients(payer_email, student_name)")
    .in("status", ["sent", "overdue"])
    .not("due_date", "is", null);

  let remindersSent = 0;
  let sendFailures = 0;

  for (const invoice of invoices ?? []) {
    const tutor = invoice.tutors as unknown as {
      reminder_cadence: { offsets_days?: number[] } | null;
      reminder_templates: ReminderTemplates;
      name: string;
    } | null;
    const client = invoice.clients as unknown as { payer_email: string | null; student_name: string } | null;

    if (!tutor || !client?.payer_email || !invoice.due_date) continue;

    const offsets = tutor.reminder_cadence?.offsets_days ?? DEFAULT_OFFSETS_DAYS;
    const daysPastDue = daysBetween(invoice.due_date, today);
    const targetOffset = latestApplicableOffset(offsets, daysPastDue);
    if (targetOffset === null) continue;

    const key = offsetKey(targetOffset);
    const template = tutor.reminder_templates?.[key];
    if (!template) continue;

    // Claim first: the unique constraint on (invoice_id, template_key)
    // means a concurrent/overlapping cron run racing on the same
    // invoice+offset gets a 23505 here and skips, instead of both runs
    // independently deciding "not yet sent" and both emailing the client.
    const { error: claimError } = await admin
      .from("reminders")
      .insert({ invoice_id: invoice.id, channel: "email", template_key: key });

    if (claimError) {
      if (claimError.code !== "23505") {
        console.error(`Reminder claim failed for invoice ${invoice.id}/${key}:`, claimError.message);
      }
      continue; // already sent (by this run or a concurrent one), or a real error — either way, don't send
    }

    const filled = interpolateTemplate(template, {
      student: client.student_name,
      tutor: tutor.name,
      amount: formatCents(invoice.total_cents),
      due_date: invoice.due_date,
      link: invoice.stripe_payment_url ?? "",
    });

    const sendResult = await sendEmail({
      to: client.payer_email,
      subject: filled.subject,
      html: `<p>${filled.body.replace(/\n/g, "<br/>")}</p>`,
    });

    if (sendResult.error) {
      // The claim row stays — we deliberately favor "never double-send" over
      // "always eventually deliver" here (no retry queue in this build).
      // Logged loudly so a real failure is visible in cron run output.
      console.error(`Reminder send failed for invoice ${invoice.id}/${key}:`, sendResult.error);
      sendFailures += 1;
      continue;
    }

    remindersSent += 1;
  }

  return NextResponse.json({
    overdueFlipped: flipped?.length ?? 0,
    invoicesScanned: invoices?.length ?? 0,
    remindersSent,
    sendFailures,
  });
}
