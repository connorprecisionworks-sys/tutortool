"use server";

import { createClient } from "@/lib/supabase/server";

export interface AuthActionResult {
  error?: string;
  needsEmailConfirmation?: boolean;
}

export async function signInAction(formData: FormData): Promise<AuthActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: error.message };
  return {};
}

export async function signUpTutorAction(formData: FormData): Promise<AuthActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!name) return { error: "Name is required." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, role: "tutor" } },
  });

  if (error) return { error: error.message };

  if (!data.session) {
    return { needsEmailConfirmation: true };
  }

  // Session exists immediately (email confirmations off) — create the tutor
  // profile row now so /tutor doesn't have to special-case a missing row.
  const { error: profileError } = await supabase.from("tutors").insert({
    auth_user_id: data.user!.id,
    name,
    email,
  });
  // Ignore unique-violation races (row already created by a concurrent request).
  if (profileError && profileError.code !== "23505") {
    return { error: profileError.message };
  }

  return {};
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
