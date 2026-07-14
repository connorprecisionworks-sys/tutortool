import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireParent } from "@/lib/auth/parent";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { RedeemInviteForm } from "@/components/parent/redeem-invite-form";

export default async function ParentHomePage() {
  const parentUser = await requireParent();
  const supabase = await createClient();

  const { data: links } = await supabase
    .from("parent_students")
    .select("relationship, clients(student_name)")
    .eq("parent_user_id", parentUser.id);

  const children = (links ?? [])
    .map((l) => (l.clients as unknown as { student_name: string } | null)?.student_name)
    .filter((name): name is string => Boolean(name));

  if (children.length === 0) {
    return (
      <div>
        <PageHeader title="Home" description="Link your child's account to get started." />
        <EmptyState
          message="Enter the invite code your tutor sent you to see your child's sessions, notes, resources, and invoices here."
          action={
            <Suspense fallback={null}>
              <RedeemInviteForm />
            </Suspense>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Home"
        description={children.length === 1 ? `Linked to ${children[0]}.` : `Linked to ${children.join(", ")}.`}
      />
      <Card>
        <p className="text-sm text-text-secondary">
          Sessions, notes, resources, and billing for {children.length === 1 ? children[0] : "your children"}{" "}
          are coming as your tutor turns them on. Check Sessions &amp; Notes, Resources, Schedule, and Billing
          in the meantime.
        </p>
      </Card>
      <div className="mt-6">
        <Suspense fallback={null}>
          <details className="text-sm text-text-secondary">
            <summary className="cursor-pointer text-text">Have another invite code?</summary>
            <div className="mt-3">
              <RedeemInviteForm />
            </div>
          </details>
        </Suspense>
      </div>
    </div>
  );
}
