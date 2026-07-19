import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { WEEKDAY_LABELS } from "@/lib/recurring-sessions";
import { EndSeriesButton } from "@/components/sessions/end-series-button";
import { formatDate } from "@/lib/date";

export default async function RecurringSessionsPage() {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const { data: series } = await supabase
    .from("recurring_sessions")
    .select("*, clients(student_name), services(name)")
    .eq("tutor_id", tutor.id)
    .order("created_at", { ascending: false });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <PageHeader
        title="Recurring sessions"
        description="Standing weekly slots — upcoming sessions generate and bill automatically."
        action={
          <Link href="/tutor/sessions/recurring/new">
            <Button>New recurring session</Button>
          </Link>
        }
      />

      {!series || series.length === 0 ? (
        <EmptyState
          message="No recurring sessions yet. Set up a fixed weekly slot to stop re-entering it every week."
          action={
            <Link href="/tutor/sessions/recurring/new">
              <Button>New recurring session</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {series.map((s) => {
            const studentName = (s.clients as unknown as { student_name: string } | null)?.student_name ?? "—";
            const serviceName = (s.services as unknown as { name: string } | null)?.name;
            return (
              <Card key={s.id} className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{studentName}</p>
                    <StatusDot
                      status={s.status === "active" ? "active" : s.status === "ended" ? "void" : "cancelled"}
                      label={s.status === "active" ? "Active" : s.status === "ended" ? "Ended" : "Cancelled"}
                    />
                  </div>
                  <p className="mt-1 text-sm text-text-secondary">
                    Every {WEEKDAY_LABELS[s.weekday]} at {s.start_time.slice(0, 5)} — {s.duration_minutes} min
                    {serviceName ? ` — ${serviceName}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-text-tertiary">
                    Starting {formatDate(s.start_date)}
                    {s.end_date ? ` through ${formatDate(s.end_date)}` : " — ongoing"}
                  </p>
                </div>
                {s.status === "active" && <EndSeriesButton recurringSessionId={s.id} fromDate={today} label="End series" />}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
