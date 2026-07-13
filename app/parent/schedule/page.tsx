import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function ParentSchedulePage() {
  return (
    <div>
      <PageHeader title="Schedule" description="Request or book time depending on how your tutor works." />
      <EmptyState message="Scheduling isn't set up yet." />
    </div>
  );
}
