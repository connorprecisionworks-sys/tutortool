import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { NewInvoiceForm } from "@/components/invoices/new-invoice-form";

export default async function NewInvoicePage() {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .eq("tutor_id", tutor.id)
    .eq("archived", false)
    .order("student_name");

  if (!clients || clients.length === 0) {
    redirect("/tutor/students/new");
  }

  return (
    <div>
      <PageHeader title="New invoice" description="Pick a student and a date range." />
      <Card className="max-w-lg">
        <NewInvoiceForm clients={clients} />
      </Card>
    </div>
  );
}
