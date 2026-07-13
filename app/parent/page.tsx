import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function ParentHomePage() {
  return (
    <div>
      <PageHeader title="Home" description="Your next session and latest note." />
      <EmptyState message="The parent portal opens up once your tutor invites you to a student. This arrives in a later phase." />
    </div>
  );
}
