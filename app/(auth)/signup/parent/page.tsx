"use client";

import { Suspense, useActionState, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signUpParentAction, type AuthActionResult } from "@/app/(auth)/actions";
import { redeemInviteAction, type RedeemInviteResult } from "@/app/parent/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldHint } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Mark } from "@/components/brand/logo";
import { AgreementCheckbox } from "@/components/legal/agreement-checkbox";

const initialState: AuthActionResult = {};

function ParentSignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get("code") ?? "");
  const tutorCode = searchParams.get("tutor_code") ?? "";
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [accountCreated, setAccountCreated] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const [state, formAction, pending] = useActionState(async (prev: AuthActionResult, formData: FormData) => {
    const result = await signUpParentAction(formData);
    if (!result.error && !result.needsEmailConfirmation) {
      setAccountCreated(true);
      // A tutor code needs its own setup step (child's name, or pick from
      // the tutor's unclaimed roster) that a Student Code doesn't — send
      // them to /join to finish that, now that they're authenticated,
      // instead of auto-redeeming here the way a Student Code can.
      if (tutorCode) {
        // push() alone is enough — these are all dynamic, uncached routes,
        // so a fresh navigation always re-renders from a live server
        // request. A trailing router.refresh() here raced push() (it
        // re-fetches whatever route was current *at dispatch time*, i.e.
        // this page, and could resolve after push() and overwrite the
        // navigation) — see the comment in accept-terms/actions.ts for the
        // confirmed repro of this same pattern.
        router.push(`/join?tutor_code=${tutorCode}`);
        return result;
      }
      const trimmedCode = code.trim();
      if (trimmedCode) {
        const fd = new FormData();
        fd.set("code", trimmedCode);
        const redeemResult = await redeemInviteAction({} as RedeemInviteResult, fd);
        if (redeemResult.error) {
          // Stay on this page and show the error instead of redirecting —
          // the account exists, but the tutor should know linking failed.
          setRedeemError(redeemResult.error);
          return result;
        }
      }
      router.push("/parent");
    }
    return result;
  }, initialState);

  if (state.needsEmailConfirmation) {
    return (
      <Card className="w-full max-w-sm text-center">
        <h1 className="mb-2 text-xl font-semibold">Check your email</h1>
        <p className="text-sm text-text-secondary">
          {tutorCode
            ? "We sent a confirmation link. Click it, sign in, then finish adding your child from the join link your tutor sent."
            : `We sent a confirmation link. Click it, sign in, then enter your Student Code${code ? ` (${code})` : ""} from the Home page.`}
        </p>
        <Link href="/login" className="mt-6 inline-block">
          <Button variant="secondary">Back to sign in</Button>
        </Link>
      </Card>
    );
  }

  if (accountCreated && redeemError) {
    return (
      <Card className="w-full max-w-sm text-center">
        <h1 className="mb-2 text-xl font-semibold">Account created</h1>
        <p className="text-sm text-text-secondary">
          But the Student Code didn&apos;t work: {redeemError}. You can try again from Home.
        </p>
        <Button
          className="mt-6"
          onClick={() => router.push("/parent")}
        >
          Continue to Home
        </Button>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <Mark className="mb-4 h-6" />
      <h1 className="mb-1 text-xl font-semibold">Create your parent account</h1>
      <p className="mb-6 text-sm text-text-secondary">
        {tutorCode
          ? "Create your account, then add your child on the next step."
          : "Enter the Student Code your tutor sent you to see your child's sessions and invoices."}
      </p>
      {tutorCode && code && (
        // Only reachable via a hand-edited/copy-pasted URL carrying both
        // params at once — no link this app generates ever sets both. The
        // tutor-code setup step takes priority (it's the richer flow: pick
        // an existing student or add a new one); the Student Code field is
        // hidden below, so make that explicit rather than silently
        // dropping whatever code was in the URL.
        <p className="mb-4 text-xs text-text-tertiary">
          Using your tutor&apos;s join link — the Student Code in this URL will be ignored.
        </p>
      )}
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
        {!tutorCode && (
          <div>
            <Label htmlFor="code">Student Code</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. A7BX92K"
              className="uppercase"
            />
            <FieldHint>
              Don&apos;t have one yet? You can create your account now and enter it later from Home.
            </FieldHint>
          </div>
        )}
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
  );
}

export default function ParentSignupPage() {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-16">
      <Suspense fallback={null}>
        <ParentSignupForm />
      </Suspense>
    </div>
  );
}
