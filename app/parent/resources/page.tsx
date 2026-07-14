import { createClient } from "@/lib/supabase/server";
import { requireParent } from "@/lib/auth/parent";
import { getLinkedStudents } from "@/lib/auth/linked-students";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { OpenResourceButton } from "@/components/resources/open-resource-button";

export default async function ParentResourcesPage() {
  const parentUser = await requireParent();
  const supabase = await createClient();

  const students = await getLinkedStudents(supabase, parentUser.id);
  const studentIds = students.map((s) => s.id);

  if (studentIds.length === 0) {
    return (
      <div>
        <PageHeader title="Resources" description="Files and links your tutor has shared." />
        <EmptyState message="Link your child's account from Home to see resources here." />
      </div>
    );
  }

  const { data: resources } = await supabase
    .from("resources")
    .select("*")
    .in("student_id", studentIds)
    .order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader title="Resources" description="Files and links your tutor has shared." />
      {!resources || resources.length === 0 ? (
        <EmptyState message="Nothing shared yet." />
      ) : (
        <div className="space-y-3">
          {resources.map((r) => (
            <Card key={r.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{r.title}</p>
                <p className="text-xs text-text-tertiary capitalize">{r.type}</p>
              </div>
              <OpenResourceButton resourceId={r.id} label="Open" />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
