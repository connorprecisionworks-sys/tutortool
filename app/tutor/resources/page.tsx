import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { OpenResourceButton } from "@/components/resources/open-resource-button";
import { DeleteResourceButton } from "@/components/resources/delete-resource-button";

export default async function ResourcesPage() {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const { data: resources } = await supabase
    .from("resources")
    .select("*, clients(student_name)")
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
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {resources.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-5 py-3 font-medium">{r.title}</td>
                  <td className="px-5 py-3 text-text-secondary">
                    {(r.clients as unknown as { student_name: string } | null)?.student_name ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-text-secondary capitalize">{r.type}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <OpenResourceButton resourceId={r.id} label="Open" />
                      <DeleteResourceButton resourceId={r.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
