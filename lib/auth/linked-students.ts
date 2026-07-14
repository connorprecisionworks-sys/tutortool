import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export interface LinkedStudent {
  id: string;
  name: string;
}

/** Shared by every parent-facing page that needs "which children is this parent linked to." */
export async function getLinkedStudents(
  supabase: SupabaseClient<Database>,
  parentUserId: string
): Promise<LinkedStudent[]> {
  const { data: links } = await supabase
    .from("parent_students")
    .select("student_id, clients(student_name)")
    .eq("parent_user_id", parentUserId);

  return (links ?? []).map((l) => ({
    id: l.student_id,
    name: (l.clients as unknown as { student_name: string } | null)?.student_name ?? "Your child",
  }));
}
