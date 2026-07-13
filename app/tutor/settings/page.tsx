import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { requireTutor } from "@/lib/auth/tutor";
import { SettingsForm } from "@/components/settings/settings-form";

export default async function SettingsPage() {
  const tutor = await requireTutor();

  return (
    <div>
      <PageHeader title="Settings" description="Standard rate, travel rule, and invoice terms." />
      <Card className="max-w-2xl">
        <SettingsForm tutor={tutor} />
      </Card>
    </div>
  );
}
