import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { PackageForm } from "@/components/packages/package-form";

export default async function NewPackagePage() {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const [{ data: clients }, { data: services }] = await Promise.all([
    supabase.from("clients").select("*").eq("tutor_id", tutor.id).eq("archived", false).order("student_name"),
    supabase.from("services").select("*").eq("tutor_id", tutor.id).eq("is_active", true).order("name"),
  ]);

  return (
    <div>
      <PageHeader
        title="New package"
        description="Sell a block of prepaid sessions to one student, or build a general package any student can draw from — those can also be featured on your public page."
      />
      <Card className="max-w-lg">
        <PackageForm clients={clients ?? []} services={services ?? []} />
      </Card>
    </div>
  );
}
