import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { getOnboardingStatus } from "@/lib/onboarding";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WelcomeHero } from "@/components/dashboard/welcome-hero";
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist";
import { formatCents } from "@/lib/money";
import { computeValueGivenCents } from "@/lib/billing";

function monthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

function yearStartDate(): string {
  return `${new Date().getUTCFullYear()}-01-01`;
}

export default async function TutorDashboardPage() {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const { start, end } = monthRange();

  const [
    onboarding,
    { data: outstandingInvoices },
    { count: overdueCount },
    { data: billedThisMonth },
    { data: sessions },
    { data: expensesThisYear },
  ] = await Promise.all([
    getOnboardingStatus(tutor),
    supabase.from("invoices").select("total_cents").eq("tutor_id", tutor.id).in("status", ["sent", "overdue"]),
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("tutor_id", tutor.id)
      .eq("status", "overdue"),
    supabase
      .from("invoices")
      .select("total_cents")
      .eq("tutor_id", tutor.id)
      .gte("sent_at", start)
      .lt("sent_at", end)
      .not("sent_at", "is", null),
    supabase
      .from("sessions")
      .select("duration_minutes, effective_rate_cents, service_price_cents, package_id, clients(is_philanthropic)")
      .eq("tutor_id", tutor.id),
    supabase.from("expenses").select("amount_cents").eq("tutor_id", tutor.id).gte("incurred_on", yearStartDate()),
  ]);

  const expensesThisYearCents = (expensesThisYear ?? []).reduce((sum, e) => sum + e.amount_cents, 0);

  const outstandingCents = (outstandingInvoices ?? []).reduce((sum, i) => sum + i.total_cents, 0);
  const billedThisMonthCents = (billedThisMonth ?? []).reduce((sum, i) => sum + i.total_cents, 0);

  let philanthropicValueCents = 0;
  let regularDiscountValueCents = 0;
  for (const s of sessions ?? []) {
    // A service-priced session (Q1) bills a flat price unrelated to the
    // client's hourly rate rule, so "gap vs. standard rate" isn't a
    // meaningful discount figure for it — skip rather than mix hourly-rate
    // discount math with flat product pricing. Same reasoning for a
    // package-drawn session (Q5): it was already paid for as part of a
    // lump-sum package purchase, not billed at any per-session rate.
    if (s.service_price_cents != null || s.package_id != null) continue;
    const isPhilanthropic = (s.clients as unknown as { is_philanthropic: boolean } | null)?.is_philanthropic ?? false;
    const value = computeValueGivenCents(tutor.standard_rate_cents, s.effective_rate_cents, s.duration_minutes);
    if (isPhilanthropic) philanthropicValueCents += value;
    else regularDiscountValueCents += value;
  }
  const totalValueGivenCents = philanthropicValueCents + regularDiscountValueCents;

  // The welcome hero replaces the page header (not the stats below it) for
  // a genuinely fresh account, so dismissing the checklist before finishing
  // setup still leaves the normal dashboard visible underneath — never a
  // blank page.
  return (
    <div>
      {onboarding.hasAnyData ? (
        <PageHeader
          title="Dashboard"
          description="Outstanding balances, this month's billing, and quick actions."
          action={
            <div className="flex gap-2">
              <Link href="/tutor/sessions/new">
                <Button variant="secondary">Log session</Button>
              </Link>
              <Link href="/tutor/invoices/new">
                <Button>New invoice</Button>
              </Link>
            </div>
          }
        />
      ) : (
        <WelcomeHero tutorName={tutor.name} />
      )}

      <OnboardingChecklist tutorId={tutor.id} status={onboarding} className="mb-6" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs text-text-secondary">Outstanding</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatCents(outstandingCents)}</p>
        </Card>
        <Card>
          <p className="text-xs text-text-secondary">Billed this month</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatCents(billedThisMonthCents)}</p>
        </Card>
        <Card>
          <p className="text-xs text-text-secondary">Overdue invoices</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{overdueCount ?? 0}</p>
        </Card>
        <Link href="/tutor/expenses">
          <Card className="h-full transition-colors hover:bg-hover">
            <p className="text-xs text-text-secondary">Expenses this year</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{formatCents(expensesThisYearCents)}</p>
          </Card>
        </Link>
      </div>

      <Card className="mt-6">
        <h2 className="text-sm font-semibold">Value given</h2>
        <p className="mt-1 text-xs text-text-tertiary">
          Your own record of discounted and pro-bono tutoring — not a tax deduction. Only unreimbursed
          out-of-pocket costs are deductible under US tax law; the value of donated services isn&apos;t.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-text-secondary">Community impact</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{formatCents(philanthropicValueCents)}</p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Regular discounts</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{formatCents(regularDiscountValueCents)}</p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Total value given</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{formatCents(totalValueGivenCents)}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
