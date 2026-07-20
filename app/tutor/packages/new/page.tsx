import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { PackageForm } from "@/components/packages/package-form";

export default async function NewPackagePage() {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const [{ data: clients }, { data: services }, { data: sessionServiceRows }] = await Promise.all([
    supabase.from("clients").select("*").eq("tutor_id", tutor.id).eq("archived", false).order("student_name"),
    supabase.from("services").select("*").eq("tutor_id", tutor.id).eq("is_active", true).order("name"),
    supabase.from("sessions").select("service_id").eq("tutor_id", tutor.id).not("service_id", "is", null),
  ]);

  // Small dataset per tutor — count occurrences per service_id in JS rather
  // than reaching for a SQL aggregate, then pick the max, to prefill the
  // package form's service picker with whatever the tutor actually bills
  // most often.
  let mostCommonServiceId: string | null = null;
  if (sessionServiceRows && sessionServiceRows.length > 0) {
    const counts = new Map<string, number>();
    for (const row of sessionServiceRows) {
      if (!row.service_id) continue;
      counts.set(row.service_id, (counts.get(row.service_id) ?? 0) + 1);
    }
    let maxCount = 0;
    for (const [id, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonServiceId = id;
      }
    }
  }

  return (
    <div>
      <PageHeader
        title="New package"
        description="Sell a block of prepaid sessions to one student, or build a general package any student can draw from — those can also be featured on your public page."
      />
      <Card className="max-w-lg">
        <PackageForm clients={clients ?? []} services={services ?? []} mostCommonServiceId={mostCommonServiceId} />
      </Card>
    </div>
  );
}
