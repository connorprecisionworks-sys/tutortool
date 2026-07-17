import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateRecurringInstances } from "@/lib/recurring-sessions";

/**
 * Daily job that rolls every active recurring series' generated instances
 * forward so the rolling horizon (RECURRING_SESSION_HORIZON_WEEKS) never
 * runs dry between tutor visits. The initial batch for a brand-new series
 * is generated synchronously at creation time (createRecurringSessionAction)
 * so a tutor sees upcoming sessions immediately — this job only needs to
 * extend already-created series further out as time passes. Same
 * CRON_SECRET auth pattern as /api/cron/reminders; uses the admin client
 * since it isn't scoped to one authenticated tutor.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return runGenerationJob(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return runGenerationJob(request);
}

async function runGenerationJob(request: NextRequest): Promise<NextResponse> {
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
  const { data: series, error } = await admin.from("recurring_sessions").select("*").eq("status", "active");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let totalCreated = 0;
  let seriesErrored = 0;
  for (const s of series ?? []) {
    try {
      const { created } = await generateRecurringInstances(admin, s);
      totalCreated += created;
    } catch (genError) {
      seriesErrored++;
      console.error(`generateRecurringInstances failed for series ${s.id}:`, genError);
    }
  }

  return NextResponse.json({ seriesChecked: series?.length ?? 0, instancesCreated: totalCreated, seriesErrored });
}
