import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function TutorDashboardPage() {
  return (
    <div>
      <PageHeader title="Dashboard" description="Outstanding balances, this month's billing, and quick actions." />
      <EmptyState message="Dashboard numbers land here once you've logged sessions and sent invoices." />
    </div>
  );
}
