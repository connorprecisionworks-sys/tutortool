import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { updateExpenseAction } from "@/app/tutor/expenses/actions";

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tutor = await requireTutor();
  const supabase = await createClient();

  const [{ data: expense }, { data: students }, { data: sessions }] = await Promise.all([
    supabase.from("expenses").select("*").eq("id", id).eq("tutor_id", tutor.id).maybeSingle(),
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

  if (!expense) notFound();

  return (
    <div>
      <PageHeader title="Edit expense" description={`Logged ${expense.incurred_on}.`} />
      <Card className="max-w-2xl">
        <ExpenseForm
          expense={expense}
          students={students ?? []}
          sessions={sessions ?? []}
          mileageRateCents={tutor.mileage_rate_cents}
          action={updateExpenseAction}
          onSuccessPath="/tutor/expenses"
        />
      </Card>
    </div>
  );
}
