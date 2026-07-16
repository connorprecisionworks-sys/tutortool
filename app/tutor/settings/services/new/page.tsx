import { requireTutor } from "@/lib/auth/tutor";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { ServiceForm } from "@/components/settings/service-form";
import { createServiceAction } from "@/app/tutor/settings/services/actions";

export default async function NewServicePage() {
  await requireTutor();

  return (
    <div>
      <PageHeader title="Add service" description="A named, flat-priced offering tutors can bill instead of the hourly rate." />
      <Card className="max-w-xl">
        <ServiceForm action={createServiceAction} onSuccessPath="/tutor/settings/services" />
      </Card>
    </div>
  );
}
