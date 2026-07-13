import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default function StudentsPage() {
  return (
    <div>
      <PageHeader
        title="Students"
        description="The families you tutor and their rate rules."
        action={<Button disabled>Add student</Button>}
      />
      <EmptyState message="No students yet. Add your first student to start billing." />
    </div>
  );
}
