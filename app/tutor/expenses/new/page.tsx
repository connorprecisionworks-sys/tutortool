import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { createExpenseAction } from "@/app/tutor/expenses/actions";

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; session_id?: string }>;
}) {
  const { category, session_id } = await searchParams;
  const tutor = await requireTutor();
  const supabase = await createClient();

  const [{ data: students }, { data: sessions }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, student_name")
      .eq("tutor_id", tutor.id)
      .eq("archived", false)
      .order("student_name"),
    supabase
      .from("sessions")
      .select("id, occurred_on, travel_minutes")
      .eq("tutor_id", tutor.id)
      .gt("travel_minutes", 0)
      .order("occurred_on", { ascending: false })
      .limit(50),
  ]);

  return (
    <div>
      <PageHeader title="Add expense" description="Log a deductible business expense, receipt, or mileage trip." />
      <Card className="max-w-2xl">
        <ExpenseForm
          students={students ?? []}
          sessions={sessions ?? []}
          mileageRateCents={tutor.mileage_rate_cents}
          action={createExpenseAction}
          onSuccessPath="/tutor/expenses"
          defaultCategory={category}
          defaultSessionId={session_id}
        />
      </Card>
    </div>
  );
}
