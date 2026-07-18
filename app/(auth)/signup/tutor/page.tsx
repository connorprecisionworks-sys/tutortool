"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUpTutorAction, type AuthActionResult } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { AgreementCheckbox } from "@/components/legal/agreement-checkbox";

const initialState: AuthActionResult = {};

export default function TutorSignupPage() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [state, formAction, pending] = useActionState(async (_: AuthActionResult, formData: FormData) => {
    const result = await signUpTutorAction(formData);
    if (!result.error && !result.needsEmailConfirmation) {
      router.push("/tutor");
      router.refresh();
    }
    return result;
  }, initialState);

  if (state.needsEmailConfirmation) {
    return (
      <div className="flex min-h-full items-center justify-center px-4 py-16">
        <Card className="w-full max-w-sm text-center">
          <h1 className="mb-2 text-xl font-semibold">Check your email</h1>
          <p className="text-sm text-text-secondary">
            We sent a confirmation link. Click it, then come back and sign in.
          </p>
          <Link href="/login" className="mt-6 inline-block">
            <Button variant="secondary">Back to sign in</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-xl font-semibold">Create your tutor account</h1>
        <p className="mb-6 text-sm text-text-secondary">
          Set up billing for your students in a few minutes.
        </p>
        <form action={formAction} className="space-y-4">
          <div>
            <Label htmlFor="name">Your name</Label>
            <Input id="name" name="name" type="text" autoComplete="name" required />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <AgreementCheckbox checked={agreed} onChange={setAgreed} />
          {state.error && <p className="text-sm text-text">{state.error}</p>}
          <Button type="submit" className="w-full" disabled={pending || !agreed}>
            {pending ? "Creating account…" : "Create account"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-text-secondary">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-text underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
