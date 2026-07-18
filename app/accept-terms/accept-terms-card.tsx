"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { acceptTermsAction, type AcceptTermsResult } from "./actions";
import { signOutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AgreementCheckbox } from "@/components/legal/agreement-checkbox";

const initialState: AcceptTermsResult = {};

export function AcceptTermsCard({
  termsVersion,
  termsEffectiveDate,
  privacyVersion,
  privacyEffectiveDate,
  next,
}: {
  termsVersion: string;
  termsEffectiveDate: string;
  privacyVersion: string;
  privacyEffectiveDate: string;
  next: string;
}) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [state, formAction, pending] = useActionState(async (_: AcceptTermsResult, formData: FormData) => {
    const result = await acceptTermsAction(formData);
    if (!result.error) {
      router.push(next);
      router.refresh();
    }
    return result;
  }, initialState);

  return (
    <Card className="w-full max-w-sm">
      <h1 className="mb-1 text-xl font-semibold">Updated Terms &amp; Privacy Policy</h1>
      <p className="mb-6 text-sm text-text-secondary">
        We&apos;ve updated our Terms of Service (v{termsVersion}, effective {termsEffectiveDate}) and Privacy
        Policy (v{privacyVersion}, effective {privacyEffectiveDate}). Please review and accept to keep using
        Slate.
      </p>
      <form action={formAction} className="space-y-4">
        <AgreementCheckbox checked={agreed} onChange={setAgreed} />
        {state.error && <p className="text-sm text-text">{state.error}</p>}
        <Button type="submit" className="w-full" disabled={pending || !agreed}>
          {pending ? "Saving…" : "Agree and continue"}
        </Button>
      </form>
      <form action={signOutAction} className="mt-4 text-center">
        <button type="submit" className="text-sm text-text-secondary underline underline-offset-2 hover:text-text">
          Sign out instead
        </button>
      </form>
    </Card>
  );
}
