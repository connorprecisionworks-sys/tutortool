import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ResourceRow } from "@/components/resources/resource-row";

export default async function ResourcesPage() {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const { data: resources } = await supabase
    .from("resources")
    .select("*, clients(student_name), resource_gates(id, price_cents, status, unlock_invoice_id)")
    .eq("tutor_id", tutor.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader
        title="Resources"
        description="Files and links shared with students and classes."
        action={
          <Link href="/tutor/resources/new">
            <Button>Add resource</Button>
          </Link>
        }
      />
      {!resources || resources.length === 0 ? (
        <EmptyState
          message="No resources yet. Add a file or link to share with a student or class."
          action={
            <Link href="/tutor/resources/new">
              <Button>Add resource</Button>
            </Link>
          }
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-surface-sunken text-left text-text-secondary">
              <tr>
                <th className="px-5 py-3 font-medium">Title</th>
                <th className="px-5 py-3 font-medium">Student</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Price</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {resources.map((r) => {
                const gate = r.resource_gates as unknown as {
                  id: string;
                  price_cents: number;
                  status: string;
                  unlock_invoice_id: string | null;
                } | null;
                return (
                  <ResourceRow
                    key={r.id}
                    id={r.id}
                    title={r.title}
                    studentName={(r.clients as unknown as { student_name: string } | null)?.student_name ?? "—"}
                    type={r.type}
                    urlOrPath={r.url_or_path}
                    gate={gate}
                  />
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
