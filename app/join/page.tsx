import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { intendedRole } from "@/lib/auth/user";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JoinCodeForm } from "@/components/parent/join-code-form";
import { TutorCodeSetupForm } from "@/components/parent/tutor-code-setup-form";
import { Mark } from "@/components/brand/logo";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; tutor_code?: string }>;
}) {
  const { code: rawCode, tutor_code: rawTutorCode } = await searchParams;
  const code = (rawCode ?? "").trim().toUpperCase();
  const tutorCode = (rawTutorCode ?? "").trim().toUpperCase();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: "tutor" | "parent" | null = null;
  if (user) {
    const { data: userRow } = await supabase
      .from("users")
      .select("role")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    role = (userRow?.role as "tutor" | "parent" | undefined) ?? intendedRole(user);

    // get_unclaimed_students_for_tutor_code (unlike this page's own role
    // check) requires an actual `users` row to exist, not just the
    // intendedRole() fallback — a parent who signed up with email
    // confirmation pending has no `users` row yet until requireParent()
    // backfills it (see lib/auth/parent.ts), and /join never calls that
    // (it can't — it needs to render its own UI for a tutor or a
    // logged-out visitor, not redirect). Mirror the same backfill here,
    // best-effort, so the RPC below sees a real parent row.
    if (!userRow && role === "parent") {
      await supabase
        .from("users")
        .insert({
          auth_user_id: user.id,
          role: "parent",
          name: (user.user_metadata?.name as string | undefined) ?? user.email ?? "Parent",
          email: user.email ?? "",
        })
        .select("id")
        .maybeSingle();
      // Ignore any error (e.g. 23505 from a concurrent request already
      // inserting it) — either way the row should exist by the time the
      // RPC below runs.
    }
  }

  const nextPath = tutorCode ? `/join?tutor_code=${tutorCode}` : code ? `/join?code=${code}` : "/join";
  const nextParam = encodeURIComponent(nextPath);

  // Public lookup (works with no session) so the pre-signup CTA can say
  // whose roster this is, same minimal-public-surface pattern as the
  // public tutor page / booking link.
  const tutorName = tutorCode
    ? (await supabase.rpc("get_tutor_name_for_code", { p_code: tutorCode })).data
    : null;

  let unclaimedStudents: { id: string; student_name: string }[] = [];
  let unclaimedError: string | null = null;
  if (tutorCode && role === "parent") {
    const { data, error } = await supabase.rpc("get_unclaimed_students_for_tutor_code", { p_code: tutorCode });
    if (error) {
      unclaimedError = error.message;
    } else {
      unclaimedStudents = (data as unknown as { id: string; student_name: string }[] | null) ?? [];
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm">
        <Mark className="mb-4 h-6" />
        <h1 className="mb-1 text-xl font-semibold">Join as a parent</h1>

        {role === "tutor" ? (
          <>
            <p className="mb-6 text-sm text-text-secondary">
              This link is for parents — you&apos;re signed in as a tutor.
            </p>
            <Link href="/tutor">
              <Button variant="secondary" className="w-full">
                Go to your dashboard
              </Button>
            </Link>
          </>
        ) : user && tutorCode ? (
          tutorName ? (
            <>
              {unclaimedError && (
                <p className="mb-3 text-xs text-text-tertiary">
                  Couldn&apos;t load {tutorName}&apos;s existing students ({unclaimedError}) — you can still add
                  your child by name below.
                </p>
              )}
              <TutorCodeSetupForm tutorCode={tutorCode} tutorName={tutorName} unclaimedStudents={unclaimedStudents} />
            </>
          ) : (
            <p className="text-sm text-text-secondary">Invalid code. Double-check with your tutor.</p>
          )
        ) : user ? (
          <>
            <p className="mb-6 text-sm text-text-secondary">
              Confirm the code below to link your child&apos;s account.
            </p>
            <JoinCodeForm code={code} />
          </>
        ) : tutorCode ? (
          <>
            <p className="mb-6 text-sm text-text-secondary">
              {tutorName
                ? `Join ${tutorName}'s roster — create an account or sign in to add your child.`
                : "Invalid code. Double-check with your tutor."}
            </p>
            {tutorName && (
              <div className="space-y-3">
                <Link href={`/signup/parent?tutor_code=${tutorCode}`}>
                  <Button className="w-full">Create a parent account</Button>
                </Link>
                <Link href={`/login?next=${nextParam}`}>
                  <Button variant="secondary" className="w-full">
                    I already have an account
                  </Button>
                </Link>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="mb-6 text-sm text-text-secondary">
              {code ? `Code ${code} is ready — create an account or sign in to use it.` : "Enter the Student Code your tutor sent you."}
            </p>
            <div className="space-y-3">
              <Link href={code ? `/signup/parent?code=${code}` : "/signup/parent"}>
                <Button className="w-full">Create a parent account</Button>
              </Link>
              <Link href={`/login?next=${nextParam}`}>
                <Button variant="secondary" className="w-full">
                  I already have an account
                </Button>
              </Link>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
