import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { intendedRole } from "@/lib/auth/user";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JoinCodeForm } from "@/components/parent/join-code-form";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code: rawCode } = await searchParams;
  const code = (rawCode ?? "").trim().toUpperCase();

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
  }

  const nextParam = encodeURIComponent(code ? `/join?code=${code}` : "/join");

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm">
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
        ) : user ? (
          <>
            <p className="mb-6 text-sm text-text-secondary">
              Confirm the code below to link your child&apos;s account.
            </p>
            <JoinCodeForm code={code} />
          </>
        ) : (
          <>
            <p className="mb-6 text-sm text-text-secondary">
              {code ? `Code ${code} is ready — create an account or sign in to use it.` : "Enter the invite code your tutor sent you."}
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
