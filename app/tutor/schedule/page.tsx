import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function SchedulePage() {
  return (
    <div>
      <PageHeader title="Schedule" description="Your availability and upcoming bookings." />
      <EmptyState message="Scheduling isn't set up yet. This arrives in a later phase — for now, log sessions manually from Sessions." />
    </div>
  );
}
