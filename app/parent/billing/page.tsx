import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function ParentBillingPage() {
  return (
    <div>
      <PageHeader title="Billing" description="Your invoices and payments." />
      <EmptyState message="No invoices yet." />
    </div>
  );
}
