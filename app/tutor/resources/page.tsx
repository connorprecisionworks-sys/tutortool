import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default function ResourcesPage() {
  return (
    <div>
      <PageHeader
        title="Resources"
        description="Files and links shared with students and classes."
        action={<Button disabled>Add resource</Button>}
      />
      <EmptyState message="No resources yet. Add a file or link to share with a student or class." />
    </div>
  );
}
