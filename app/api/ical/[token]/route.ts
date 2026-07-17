import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildIcsFeed } from "@/lib/ical";

interface IcalFeedData {
  found: boolean;
  tutor_name?: string;
  sessions?: {
    id: string;
    occurred_on: string;
    start_time: string | null;
    duration_minutes: number;
    location: string | null;
    student_name: string;
    service_name: string | null;
  }[];
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Same anon-role-via-server-client pattern as every other public RPC in
  // this app (get_booking_link_public, get_public_tutor_profile) — the
  // calendar app fetching this URL has no Supabase session either.
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_ical_feed", { p_token: token });
  const feed = data as unknown as IcalFeedData;

  if (!feed?.found) {
    return new NextResponse("Not found.", { status: 404 });
  }

  const ics = buildIcsFeed(feed.tutor_name ?? "Tutor", feed.sessions ?? []);

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="slate-sessions.ics"',
      "Cache-Control": "no-store",
    },
  });
}
