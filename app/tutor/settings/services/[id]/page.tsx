import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { ServiceForm } from "@/components/settings/service-form";
import { updateServiceAction } from "@/app/tutor/settings/services/actions";

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tutor = await requireTutor();
  const supabase = await createClient();

  const { data: service } = await supabase
    .from("services")
    .select("*")
    .eq("id", id)
    .eq("tutor_id", tutor.id)
    .maybeSingle();

  if (!service) notFound();

  return (
    <div>
      <PageHeader title="Edit service" description="Editing here never rewrites sessions already billed against it." />
      <Card className="max-w-xl">
        <ServiceForm service={service} action={updateServiceAction} onSuccessPath="/tutor/settings/services" />
      </Card>
    </div>
  );
}
