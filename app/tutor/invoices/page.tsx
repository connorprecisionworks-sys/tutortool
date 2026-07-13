import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default function InvoicesPage() {
  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Draft, sent, paid, and overdue invoices."
        action={<Button disabled>New invoice</Button>}
      />
      <EmptyState message="No invoices yet. Log a few sessions, then bundle them into your first invoice." />
    </div>
  );
}
