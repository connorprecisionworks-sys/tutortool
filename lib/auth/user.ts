import type { User } from "@supabase/supabase-js";

/**
 * The role chosen at signup (stored in auth user_metadata immediately by
 * both signUpTutorAction/signUpParentAction, regardless of whether email
 * confirmation deferred creating the `users` row). This is the source of
 * truth for lazy `users` row creation — NOT a default-to-tutor guess —
 * so a parent who hasn't confirmed their email yet doesn't get silently
 * provisioned as a tutor the first time any requireTutor()-gated route
 * happens to run first.
 */
export function intendedRole(user: User): "tutor" | "parent" {
  return user.user_metadata?.role === "parent" ? "parent" : "tutor";
}
