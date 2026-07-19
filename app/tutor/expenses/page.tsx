import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/date";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from "@/lib/expenses";
import { DeleteExpenseRowButton } from "@/components/expenses/delete-expense-row-button";
import { ReceiptLink } from "@/components/expenses/receipt-link";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: yearParam } = await searchParams;
  const currentYear = new Date().getUTCFullYear();
  const year = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : currentYear;

  const tutor = await requireTutor();
  const supabase = await createClient();

  const [{ data: expenses }, { data: allExpensesForYearOptions }] = await Promise.all([
    supabase
      .from("expenses")
      .select("*, clients(student_name)")
      .eq("tutor_id", tutor.id)
      .gte("incurred_on", `${year}-01-01`)
      .lte("incurred_on", `${year}-12-31`)
      .order("incurred_on", { ascending: false }),
    supabase.from("expenses").select("incurred_on").eq("tutor_id", tutor.id).order("incurred_on"),
  ]);

  const yearOptions = Array.from(
    new Set([currentYear, ...(allExpensesForYearOptions ?? []).map((e) => new Date(e.incurred_on).getUTCFullYear())])
  ).sort((a, b) => b - a);

  const totalsByCategory = new Map<ExpenseCategory, number>();
  let totalCents = 0;
  let mileageMiles = 0;
  for (const e of expenses ?? []) {
    const cat = e.category as ExpenseCategory;
    totalsByCategory.set(cat, (totalsByCategory.get(cat) ?? 0) + e.amount_cents);
    totalCents += e.amount_cents;
    if (cat === "mileage" && e.miles) mileageMiles += Number(e.miles);
  }

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Deductible business expenses, receipts, and mileage — for your records and your accountant."
        action={
          <div className="flex gap-2">
            <a href={`/tutor/expenses/export?year=${year}`}>
              <Button variant="secondary">Export CSV</Button>
            </a>
            <Link href="/tutor/expenses/new">
              <Button>Add expense</Button>
            </Link>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        {yearOptions.map((y) => (
          <Link
            key={y}
            href={`/tutor/expenses?year=${y}`}
            className={
              y === year
                ? "rounded-lg bg-hover px-3 py-1.5 font-medium text-text"
                : "rounded-lg px-3 py-1.5 text-text-secondary hover:bg-hover hover:text-text"
            }
          >
            {y}
          </Link>
        ))}
      </div>

      <Card className="mb-6">
        <h2 className="mb-4 text-sm font-semibold">{year} summary</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {EXPENSE_CATEGORIES.map((cat) => (
            <div key={cat}>
              <p className="text-xs text-text-secondary">{EXPENSE_CATEGORY_LABELS[cat]}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{formatCents(totalsByCategory.get(cat) ?? 0)}</p>
              {cat === "mileage" && mileageMiles > 0 && (
                <p className="text-xs text-text-tertiary">{mileageMiles.toFixed(1)} mi</p>
              )}
            </div>
          ))}
        </div>
        <div className="mt-6 border-t border-border pt-4">
          <p className="text-xs text-text-secondary">Total, {year}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatCents(totalCents)}</p>
        </div>
      </Card>

      {!expenses || expenses.length === 0 ? (
        <EmptyState
          message={`No expenses logged for ${year}. Add your first supplies purchase, training cost, or mileage trip.`}
          action={
            <Link href="/tutor/expenses/new">
              <Button>Add expense</Button>
            </Link>
          }
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-surface-sunken text-left text-text-secondary">
              <tr>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Vendor / detail</th>
                <th className="px-5 py-3 font-medium">Student</th>
                <th className="px-5 py-3 font-medium">Receipt</th>
                <th className="px-5 py-3 text-right font-medium">Amount</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => {
                const cat = e.category as ExpenseCategory;
                const studentName = (e.clients as unknown as { student_name: string } | null)?.student_name;
                return (
                  <tr key={e.id} className="border-t border-border hover:bg-hover">
                    <td className="px-5 py-3 text-text-secondary">{formatDate(e.incurred_on)}</td>
                    <td className="px-5 py-3">
                      <Link href={`/tutor/expenses/${e.id}`} className="font-medium">
                        {EXPENSE_CATEGORY_LABELS[cat]}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-text-secondary">
                      {cat === "mileage"
                        ? `${e.miles} mi${e.from_location || e.to_location ? ` — ${e.from_location ?? "?"} → ${e.to_location ?? "?"}` : ""}`
                        : (e.vendor ?? e.note ?? "—")}
                    </td>
                    <td className="px-5 py-3 text-text-secondary">{studentName ?? "—"}</td>
                    <td className="px-5 py-3">
                      {e.receipt_path ? <ReceiptLink expenseId={e.id} /> : <span className="text-text-tertiary">—</span>}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatCents(e.amount_cents)}</td>
                    <td className="px-5 py-3 text-right">
                      <DeleteExpenseRowButton expenseId={e.id} />
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
