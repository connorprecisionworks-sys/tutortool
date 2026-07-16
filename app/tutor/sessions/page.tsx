import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { computeSessionAmountCents } from "@/lib/billing";
import { formatCents } from "@/lib/money";
import { DeleteSessionRowButton } from "@/components/sessions/delete-session-row-button";

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = status === "billed" ? "billed" : status === "logged" ? "logged" : "all";

  const tutor = await requireTutor();
  const supabase = await createClient();

  let query = supabase
    .from("sessions")
    .select("*, clients(student_name), services(name)")
    .eq("tutor_id", tutor.id)
    .order("occurred_on", { ascending: false });

  if (filter !== "all") query = query.eq("status", filter);

  const { data: sessions } = await query;

  const { data: activeClients } = await supabase
    .from("clients")
    .select("id")
    .eq("tutor_id", tutor.id)
    .eq("archived", false)
    .limit(1);

  const hasClients = (activeClients?.length ?? 0) > 0;

  return (
    <div>
      <PageHeader
        title="Sessions"
        description="Every session you've logged, billed and unbilled."
        action={
          hasClients ? (
            <Link href="/tutor/sessions/new">
              <Button>Log session</Button>
            </Link>
          ) : (
            <Link href="/tutor/students/new">
              <Button>Add a student first</Button>
            </Link>
          )
        }
      />

      <div className="mb-4 flex gap-2 text-sm">
        {(["all", "logged", "billed"] as const).map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/tutor/sessions" : `/tutor/sessions?status=${f}`}
            className={filter === f ? "font-medium text-text" : "text-text-secondary hover:text-text"}
          >
            {f === "all" ? "All" : f === "logged" ? "Unbilled" : "Billed"}
          </Link>
        ))}
      </div>

      {!sessions || sessions.length === 0 ? (
        <EmptyState
          message={
            !hasClients
              ? "Add a student first, then log your first session."
              : "No sessions logged yet."
          }
          action={
            hasClients && (
              <Link href="/tutor/sessions/new">
                <Button>Log session</Button>
              </Link>
            )
          }
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-surface-sunken text-left text-text-secondary">
              <tr>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Student</th>
                <th className="px-5 py-3 font-medium">Duration</th>
                <th className="px-5 py-3 font-medium">Travel</th>
                <th className="px-5 py-3 text-right font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const amount = computeSessionAmountCents({
                  durationMinutes: s.duration_minutes,
                  travelMinutes: s.travel_minutes,
                  effectiveRateCents: s.effective_rate_cents,
                  billTravel: s.bill_travel,
                  travelRateCents: s.travel_rate_cents ?? 0,
                  servicePriceCents: s.service_price_cents,
                });
                return (
                  <tr key={s.id} className="border-t border-border hover:bg-hover">
                    <td className="px-5 py-3">
                      {s.status === "logged" ? (
                        <Link href={`/tutor/sessions/${s.id}`} className="font-medium">
                          {s.occurred_on}
                        </Link>
                      ) : (
                        s.occurred_on
                      )}
                    </td>
                    <td className="px-5 py-3 text-text-secondary">
                      {(s.clients as unknown as { student_name: string } | null)?.student_name ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-text-secondary">
                      {s.duration_minutes} min
                      {(s.services as unknown as { name: string } | null)?.name && (
                        <span className="ml-1.5 text-xs text-text-tertiary">
                          · {(s.services as unknown as { name: string }).name}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-text-secondary">
                      {s.travel_minutes > 0 ? `${s.travel_minutes} min${s.bill_travel ? "" : " (unbilled)"}` : "—"}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatCents(amount)}</td>
                    <td className="px-5 py-3">
                      <StatusDot status={s.status} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      {s.status === "logged" && <DeleteSessionRowButton sessionId={s.id} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
