import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function ParentSessionsPage() {
  return (
    <div>
      <PageHeader title="Sessions & Notes" description="Upcoming and past sessions, plus notes your tutor has shared." />
      <EmptyState message="Nothing here yet." />
    </div>
  );
}
