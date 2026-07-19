import { createClient } from "@/lib/supabase/server";
import { requireParent } from "@/lib/auth/parent";
import { getLinkedStudents } from "@/lib/auth/linked-students";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { OpenResourceButton } from "@/components/resources/open-resource-button";
import { formatCents } from "@/lib/money";

export default async function ParentResourcesPage() {
  const parentUser = await requireParent();
  const supabase = await createClient();

  const students = await getLinkedStudents(supabase, parentUser.id);

  if (students.length === 0) {
    return (
      <div>
        <PageHeader title="Resources" description="Files and links your tutor has shared." />
        <EmptyState message="Link your child's account from Home to see resources here." />
      </div>
    );
  }

  // Every parent-facing resource read goes through this RPC, not a direct
  // table select — it's the only thing that can tell a locked gated
  // resource's url_or_path from an unlocked/ungated one apart, since RLS
  // can't null out a single column on an otherwise-visible row.
  const { data: resources } = await supabase.rpc("get_parent_resources");

  return (
    <div>
      <PageHeader title="Resources" description="Files and links your tutor has shared." />
      {!resources || resources.length === 0 ? (
        <EmptyState message="Nothing shared yet." />
      ) : (
        <div className="space-y-3">
          {resources.map((r) => {
            const locked = r.gate_status === "locked";
            return (
              <Card key={r.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{r.title}</p>
                  <p className="text-xs text-text-tertiary capitalize">
                    {r.type}
                    {students.length > 1 ? ` · ${r.student_name}` : ""}
                  </p>
                  {locked && (
                    <p className="mt-1 text-xs text-text-secondary">
                      Locked — {formatCents(r.gate_price_cents ?? 0)} to unlock. Your tutor will invoice this;
                      it unlocks automatically once paid.
                    </p>
                  )}
                </div>
                {locked ? (
                  <span className="text-xs font-medium text-text-tertiary">Locked</span>
                ) : (
                  <OpenResourceButton resourceId={r.id} label="Open" />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
