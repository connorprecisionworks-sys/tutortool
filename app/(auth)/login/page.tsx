"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signInAction, type AuthActionResult } from "@/app/(auth)/actions";
import { safeNext } from "@/lib/auth/safe-redirect";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

const initialState: AuthActionResult = {};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, formAction, pending] = useActionState(async (_: AuthActionResult, formData: FormData) => {
    const result = await signInAction(formData);
    if (!result.error) {
      router.push(safeNext(searchParams.get("next"), "/tutor"));
    }
    return result;
  }, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state.error && <p className="text-sm text-text">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-xl font-semibold">Sign in</h1>
        <p className="mb-6 text-sm text-text-secondary">Welcome back to Slate.</p>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
        <p className="mt-6 text-center text-sm text-text-secondary">
          New here?{" "}
          <Link href="/signup/tutor" className="font-medium text-text underline underline-offset-2">
            I&apos;m a tutor
          </Link>{" "}
          ·{" "}
          <Link href="/signup/parent" className="font-medium text-text underline underline-offset-2">
            I&apos;m a parent
          </Link>
        </p>
      </Card>
    </div>
  );
}
