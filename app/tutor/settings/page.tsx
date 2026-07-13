import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" description="Standard rate, travel rule, invoice terms, reminders, Stripe." />
      <EmptyState message="Settings arrive with the P1 auth + rate rules build." />
    </div>
  );
}
