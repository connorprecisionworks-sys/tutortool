import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function ParentResourcesPage() {
  return (
    <div>
      <PageHeader title="Resources" description="Files and links your tutor has shared." />
      <EmptyState message="Nothing shared yet." />
    </div>
  );
}
