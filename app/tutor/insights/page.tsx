import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCents } from "@/lib/money";
import { computeSessionAmountCents, computeValueGivenCents } from "@/lib/billing";
import { monthRange, quarterRange, trailingMonths } from "@/lib/insights";
import { RevenueBarChart } from "@/components/insights/revenue-bar-chart";
import { TopStudentsList } from "@/components/insights/top-students-list";

export default async function InsightsPage() {
  const tutor = await requireTutor();
  const supabase = await createClient();
  const todayIso = new Date().toISOString().slice(0, 10);

  const [{ data: paidInvoices }, { data: openInvoices }, { data: unbilledSessions }, { data: taughtSessions }, { data: valueGivenSessions }] =
    await Promise.all([
      supabase
        .from("invoices")
        .select("total_cents, paid_at, client_id, clients(student_name)")
        .eq("tutor_id", tutor.id)
        .eq("status", "paid"),
      supabase.from("invoices").select("total_cents").eq("tutor_id", tutor.id).in("status", ["sent", "overdue"]),
      supabase
        .from("sessions")
        .select("duration_minutes, travel_minutes, effective_rate_cents, travel_rate_cents, bill_travel, service_price_cents, occurred_on")
        .eq("tutor_id", tutor.id)
        .eq("status", "logged")
        .is("cancelled_at", null)
        .is("package_id", null)
        .is("invoice_id", null)
        .gte("occurred_on", todayIso),
      supabase
        .from("sessions")
        .select("duration_minutes, occurred_on")
        .eq("tutor_id", tutor.id)
        .in("status", ["logged", "billed"])
        .is("cancelled_at", null)
        .lte("occurred_on", todayIso),
      supabase
        .from("sessions")
        .select("duration_minutes, effective_rate_cents, service_price_cents, package_id, clients(is_philanthropic)")
        .eq("tutor_id", tutor.id),
    ]);

  const hasAnyData = (paidInvoices?.length ?? 0) > 0 || (taughtSessions?.length ?? 0) > 0 || (openInvoices?.length ?? 0) > 0;

  if (!hasAnyData) {
    return (
      <div>
        <PageHeader title="Insights" description="Revenue, outstanding balances, and value given at a glance." />
        <EmptyState message="No billing history yet. Insights fill in once you've logged sessions and sent invoices." />
      </div>
    );
  }

  const now = new Date();
  const { start: monthStart, end: monthEnd } = monthRange(now);
  const { start: quarterStart, end: quarterEnd } = quarterRange(now);

  const sumPaidInRange = (startIso: string, endIso: string) =>
    (paidInvoices ?? [])
      .filter((i) => i.paid_at && i.paid_at >= startIso && i.paid_at < endIso)
      .reduce((sum, i) => sum + i.total_cents, 0);

  const revenueThisMonthCents = sumPaidInRange(monthStart, monthEnd);
  const revenueThisQuarterCents = sumPaidInRange(quarterStart, quarterEnd);
  const outstandingCents = (openInvoices ?? []).reduce((sum, i) => sum + i.total_cents, 0);

  const bookedUnbilledCents = (unbilledSessions ?? []).reduce(
    (sum, s) =>
      sum +
      computeSessionAmountCents({
        durationMinutes: s.duration_minutes,
        travelMinutes: s.travel_minutes,
        effectiveRateCents: s.effective_rate_cents,
        billTravel: s.bill_travel,
        travelRateCents: s.travel_rate_cents ?? 0,
        servicePriceCents: s.service_price_cents,
      }),
    0
  );

  const taughtThisMonth = (taughtSessions ?? []).filter((s) => s.occurred_on >= monthStart.slice(0, 10) && s.occurred_on < monthEnd.slice(0, 10));
  const sessionsTaughtThisMonth = taughtThisMonth.length;
  const hoursTaughtThisMonth = taughtThisMonth.reduce((sum, s) => sum + s.duration_minutes, 0) / 60;

  let philanthropicValueCents = 0;
  let regularDiscountValueCents = 0;
  for (const s of valueGivenSessions ?? []) {
    if (s.service_price_cents != null || s.package_id != null) continue;
    const isPhilanthropic = (s.clients as unknown as { is_philanthropic: boolean } | null)?.is_philanthropic ?? false;
    const value = computeValueGivenCents(tutor.standard_rate_cents, s.effective_rate_cents, s.duration_minutes);
    if (isPhilanthropic) philanthropicValueCents += value;
    else regularDiscountValueCents += value;
  }
  const totalValueGivenCents = philanthropicValueCents + regularDiscountValueCents;

  const revenueByStudent = new Map<string, { studentName: string; cents: number }>();
  for (const inv of paidInvoices ?? []) {
    const studentName = (inv.clients as unknown as { student_name: string } | null)?.student_name ?? "Unknown";
    const existing = revenueByStudent.get(inv.client_id);
    if (existing) existing.cents += inv.total_cents;
    else revenueByStudent.set(inv.client_id, { studentName, cents: inv.total_cents });
  }
  const topStudents = Array.from(revenueByStudent.values())
    .sort((a, b) => b.cents - a.cents)
    .slice(0, 5);

  const months = trailingMonths(6, now);
  const monthlyRevenueBars = months.map((m) => ({ label: m.label, cents: sumPaidInRange(m.start, m.end) }));

  return (
    <div>
      <PageHeader title="Insights" description="Revenue, outstanding balances, and value given at a glance." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs text-text-secondary">Revenue this month</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatCents(revenueThisMonthCents)}</p>
        </Card>
        <Card>
          <p className="text-xs text-text-secondary">Revenue this quarter</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatCents(revenueThisQuarterCents)}</p>
        </Card>
        <Card>
          <p className="text-xs text-text-secondary">Outstanding</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatCents(outstandingCents)}</p>
        </Card>
        <Card>
          <p className="text-xs text-text-secondary">Booked, not yet billed</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatCents(bookedUnbilledCents)}</p>
        </Card>
        <Card>
          <p className="text-xs text-text-secondary">Sessions taught this month</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{sessionsTaughtThisMonth}</p>
        </Card>
        <Card>
          <p className="text-xs text-text-secondary">Hours taught this month</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{hoursTaughtThisMonth.toFixed(1)}</p>
        </Card>
        <Card className="sm:col-span-2">
          <p className="text-xs text-text-secondary">Total value given</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatCents(totalValueGivenCents)}</p>
          <p className="mt-1 text-xs text-text-tertiary">
            {formatCents(philanthropicValueCents)} community impact + {formatCents(regularDiscountValueCents)} regular discounts.
            Not a tax deduction.
          </p>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-semibold">Revenue, last 6 months</h2>
          <RevenueBarChart bars={monthlyRevenueBars} />
        </Card>
        <Card>
          <h2 className="mb-4 text-sm font-semibold">Top students by revenue</h2>
          {topStudents.length === 0 ? (
            <p className="text-sm text-text-secondary">No paid invoices yet.</p>
          ) : (
            <TopStudentsList students={topStudents} />
          )}
        </Card>
      </div>
    </div>
  );
}
