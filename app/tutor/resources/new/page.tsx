import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { ResourceForm } from "@/components/resources/resource-form";

export default async function NewResourcePage() {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const { data: students } = await supabase
    .from("clients")
    .select("*")
    .eq("tutor_id", tutor.id)
    .eq("archived", false)
    .order("student_name");

  if (!students || students.length === 0) {
    redirect("/tutor/students/new");
  }

  return (
    <div>
      <PageHeader title="Add resource" description="Share a file or link with a student." />
      <Card className="max-w-lg">
        <ResourceForm students={students} />
      </Card>
    </div>
  );
}
