import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { isSmsConfigured, maskPhone, normalizePhoneToE164, sendSms } from "@/lib/sms";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/date";
import { formatBookingWhen, nowAsStoredWallClockIso } from "@/lib/scheduling";
import {
  DEFAULT_OFFSETS_DAYS,
  SESSION_REMINDER_MAX_LEAD_HOURS,
  daysBetween,
  interpolateTemplate,
  latestApplicableOffset,
  offsetKey,
  type ReminderTemplates,
} from "@/lib/reminders";

export const runtime = "nodejs";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Shared claim-then-send for both the email and SMS channel, used by both
 * loops below. The two channels are independent — a failed/skipped email
 * claim never blocks the SMS attempt (and vice versa) — each has its own
 * claim row under the widened (…, channel) unique constraint, so callers
 * run both concurrently via Promise.all rather than sequentially.
 */
async function claimAndSend(
  admin: Admin,
  claim: { invoice_id?: string; session_id?: string; kind?: string; channel: "email" | "sms"; template_key: string },
  send: () => Promise<{ error?: string }>,
  logLabel: string
): Promise<"sent" | "skipped" | "failed"> {
  const { error: claimError } = await admin.from("reminders").insert(claim);

  if (claimError) {
    if (claimError.code !== "23505") {
      console.error(`Reminder claim failed for ${logLabel}:`, claimError.message);
    }
    // Already sent (by this run or a concurrent one), or a real claim
    // error — either way, don't send.
    return "skipped";
  }

  const result = await send();
  if (result.error) {
    // The claim row stays — we deliberately favor "never double-send" over
    // "always eventually deliver" here (no retry queue in this build).
    // Logged loudly so a real failure is visible in cron run output.
    console.error(`Reminder send failed for ${logLabel}:`, result.error);
    return "failed";
  }
  return "sent";
}

/**
 * Daily reminder job. vercel.json already has a cron entry pointing here
 * (0 13 * * * — 1pm UTC daily); it only activates once this is deployed on
 * Vercel with a CRON_SECRET env var set. Vercel automatically sends
 * `Authorization: Bearer $CRON_SECRET` on cron-triggered requests when the
 * env var is named exactly CRON_SECRET (already stubbed in .env.local) —
 * no secret needs to live in vercel.json. A `?secret=` query param works
 * too, for manual/local testing with curl.
 *
 * Three responsibilities per run: (1) flip any sent invoice whose due_date
 * has passed to overdue, (2) for every sent/overdue invoice, check the
 * tutor's reminder_cadence offsets against days-past-due and send the next
 * unsent reminder in the sequence, logging it so it's never resent, (3) for
 * every not-yet-happened, not-cancelled session within the tutor's
 * configured lead time, send (and log) a one-time upcoming-session
 * reminder. (3) only runs once daily like (2) — "within lead_hours of now,
 * at the moment this job happens to run" is an approximation of "N hours
 * before", same day-granularity tradeoff the invoice cadence already
 * accepts; a lead time close to 24h lines up well with a once-daily cron,
 * a much shorter one (e.g. 2h) would frequently miss the window entirely.
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
  // Bounded to match SESSION_REMINDER_MAX_LEAD_HOURS (14 days) so this
  // stays a cheap, indexable range scan and the lookahead can never fall
  // short of what a tutor's lead-time setting actually needs — the two
  // are validated against the same shared constant (see lib/reminders.ts).
  const lookaheadDate = new Date(Date.now() + SESSION_REMINDER_MAX_LEAD_HOURS * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data: flipped } = await admin
    .from("invoices")
    .update({ status: "overdue" })
    .eq("status", "sent")
    .lt("due_date", today)
    .select("id");

  // Independent reads — fetched together rather than the invoice loop's
  // sends (which can take a while, one sequential email API call each)
  // finishing before the session-reminder query even starts.
  const [{ data: invoices }, { data: upcomingSessions }] = await Promise.all([
    admin
      .from("invoices")
      .select("id, due_date, total_cents, stripe_payment_url, tutor_id, tutors(reminder_cadence, reminder_templates, name, sms_enabled), clients(payer_email, student_name, payer_phone, sms_opt_in)")
      .in("status", ["sent", "overdue"])
      .not("due_date", "is", null),
    admin
      .from("sessions")
      .select("id, occurred_on, start_time, tutor_id, tutors(name, session_reminder_lead_hours, reminder_templates, sms_enabled), clients(payer_email, student_name, payer_phone, sms_opt_in)")
      .is("cancelled_at", null)
      .not("start_time", "is", null)
      .gte("occurred_on", today)
      .lte("occurred_on", lookaheadDate),
  ]);

  let remindersSent = 0;
  let sendFailures = 0;

  for (const invoice of invoices ?? []) {
    const tutor = invoice.tutors as unknown as {
      reminder_cadence: { offsets_days?: number[] } | null;
      reminder_templates: ReminderTemplates;
      name: string;
      sms_enabled: boolean;
    } | null;
    const client = invoice.clients as unknown as {
      payer_email: string | null;
      student_name: string;
      payer_phone: string | null;
      sms_opt_in: boolean;
    } | null;

    if (!tutor || !invoice.due_date) continue;

    const offsets = tutor.reminder_cadence?.offsets_days ?? DEFAULT_OFFSETS_DAYS;
    const daysPastDue = daysBetween(invoice.due_date, today);
    const targetOffset = latestApplicableOffset(offsets, daysPastDue);
    if (targetOffset === null) continue;

    const key = offsetKey(targetOffset);
    const template = tutor.reminder_templates?.[key];
    if (!template) continue;

    const smsPhone =
      tutor.sms_enabled && isSmsConfigured() && client?.sms_opt_in
        ? normalizePhoneToE164(client.payer_phone ?? "")
        : null;
    const hasEmail = Boolean(client?.payer_email);
    const hasSms = Boolean(smsPhone);
    // No deliverable channel for this client — nothing to claim or send.
    if (!hasEmail && !hasSms) continue;

    const filled = interpolateTemplate(template, {
      student: client!.student_name,
      tutor: tutor.name,
      amount: formatCents(invoice.total_cents),
      due_date: formatDate(invoice.due_date),
      link: invoice.stripe_payment_url ?? "",
    });

    const outcomes = await Promise.all([
      hasEmail
        ? claimAndSend(
            admin,
            { invoice_id: invoice.id, channel: "email", template_key: key },
            () =>
              sendEmail({
                to: client!.payer_email!,
                subject: filled.subject,
                html: `<p>${filled.body.replace(/\n/g, "<br/>")}</p>`,
              }),
            `invoice ${invoice.id}/${key} (email)`
          )
        : Promise.resolve(null),
      hasSms
        ? claimAndSend(
            admin,
            { invoice_id: invoice.id, channel: "sms", template_key: key },
            () => sendSms({ to: smsPhone!, body: filled.body }),
            `invoice ${invoice.id}/${key} (sms, ${maskPhone(smsPhone!)})`
          )
        : Promise.resolve(null),
    ]);

    for (const outcome of outcomes) {
      if (outcome === "sent") remindersSent += 1;
      else if (outcome === "failed") sendFailures += 1;
    }
  }

  let sessionRemindersSent = 0;
  // Wall-clock-stamped-as-UTC "now", not real UTC Date.now() — sessions
  // store occurred_on/start_time as a literal local time with a 'Z'
  // suffix appended (see the TODO in app/parent/schedule/actions.ts), so
  // comparing against real UTC now() would drift by the server's actual
  // UTC offset. nowAsStoredWallClockIso() reads the same local clock
  // getters that convention assumes, keeping both sides of the comparison
  // in the same reference frame.
  const now = new Date(nowAsStoredWallClockIso()).getTime();

  for (const session of upcomingSessions ?? []) {
    const tutor = session.tutors as unknown as {
      name: string;
      session_reminder_lead_hours: number;
      reminder_templates: ReminderTemplates;
      sms_enabled: boolean;
    } | null;
    const client = session.clients as unknown as {
      payer_email: string | null;
      student_name: string;
      payer_phone: string | null;
      sms_opt_in: boolean;
    } | null;

    if (!tutor || !session.start_time) continue;

    // Wall-clock-stamped-as-UTC convention, same as everywhere else
    // scheduling touches a date+time (see the TODO in
    // app/parent/schedule/actions.ts).
    const scheduledAt = new Date(`${session.occurred_on}T${session.start_time}Z`).getTime();
    const hoursUntil = (scheduledAt - now) / (1000 * 60 * 60);
    // Unlike the invoice cadence's deliberate ">=" catch-up (a late dunning
    // email is still useful), a session reminder has no value once the
    // session has already happened — `hoursUntil <= 0` is a hard floor, not
    // a missed-run bug to patch. A cron outage spanning an entire session's
    // lead window means that one reminder is silently skipped rather than
    // sent after the fact, which would just be confusing.
    if (hoursUntil <= 0 || hoursUntil > tutor.session_reminder_lead_hours) continue;

    const template = tutor.reminder_templates?.session_reminder;
    if (!template) continue;

    const smsPhone =
      tutor.sms_enabled && isSmsConfigured() && client?.sms_opt_in
        ? normalizePhoneToE164(client.payer_phone ?? "")
        : null;
    const hasEmail = Boolean(client?.payer_email);
    const hasSms = Boolean(smsPhone);
    if (!hasEmail && !hasSms) continue;

    const filled = interpolateTemplate(template, {
      student: client!.student_name,
      tutor: tutor.name,
      when: formatBookingWhen(`${session.occurred_on}T${session.start_time}.000Z`),
    });

    // Same insert-to-claim dedup shape as the invoice loop above, scoped
    // by the partial unique index on (session_id, kind, channel) instead of
    // (invoice_id, template_key, channel) — a session gets at most one
    // session_reminder per channel ever, no cadence sequence to step through.
    const outcomes = await Promise.all([
      hasEmail
        ? claimAndSend(
            admin,
            { session_id: session.id, kind: "session_reminder", channel: "email", template_key: "session_reminder" },
            () =>
              sendEmail({
                to: client!.payer_email!,
                subject: filled.subject,
                html: `<p>${filled.body.replace(/\n/g, "<br/>")}</p>`,
              }),
            `session ${session.id} (email)`
          )
        : Promise.resolve(null),
      hasSms
        ? claimAndSend(
            admin,
            { session_id: session.id, kind: "session_reminder", channel: "sms", template_key: "session_reminder" },
            () => sendSms({ to: smsPhone!, body: filled.body }),
            `session ${session.id} (sms, ${maskPhone(smsPhone!)})`
          )
        : Promise.resolve(null),
    ]);

    for (const outcome of outcomes) {
      if (outcome === "sent") sessionRemindersSent += 1;
      else if (outcome === "failed") sendFailures += 1;
    }
  }

  return NextResponse.json({
    overdueFlipped: flipped?.length ?? 0,
    invoicesScanned: invoices?.length ?? 0,
    remindersSent,
    sessionsScanned: upcomingSessions?.length ?? 0,
    sessionRemindersSent,
    sendFailures,
  });
}
