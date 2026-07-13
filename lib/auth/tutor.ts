import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";

export type TutorRow = Tables<"tutors">;

/**
 * Every authenticated user in P1-P5 is a tutor (roles land in P6). Fetches
 * the tutor profile row, creating it with defaults on first visit if a
 * signup flow didn't already (e.g. email-confirmation was required so the
 * signup action couldn't insert with an active session yet).
 */
export async function requireTutor(): Promise<TutorRow> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: existing } = await supabase
    .from("tutors")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("tutors")
    .insert({
      auth_user_id: user.id,
      name: (user.user_metadata?.name as string | undefined) ?? user.email ?? "Tutor",
      email: user.email ?? "",
    })
    .select("*")
    .single();

  if (created) return created;

  // Unique-violation: a concurrent request (e.g. two simultaneous /tutor
  // loads on first sign-in) already inserted the row. Fetch and return it.
  if (error?.code === "23505") {
    const { data: raced } = await supabase
      .from("tutors")
      .select("*")
      .eq("auth_user_id", user.id)
      .single();
    if (raced) return raced;
  }

  throw new Error(error?.message ?? "Could not create tutor profile.");
}
