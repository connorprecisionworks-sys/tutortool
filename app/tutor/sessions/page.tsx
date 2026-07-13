import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default function SessionsPage() {
  return (
    <div>
      <PageHeader
        title="Sessions"
        description="Every session you've logged, billed and unbilled."
        action={<Button disabled>Log session</Button>}
      />
      <EmptyState message="No sessions logged yet. Add a student first, then log your first session." />
    </div>
  );
}
