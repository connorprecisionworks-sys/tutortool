"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { CopyButton } from "@/components/ui/copy-button";
import { createStudentAction, type StudentFormResult } from "@/app/tutor/students/actions";
import { ackOnboardingAction } from "@/app/onboarding/actions";

const initialState: StudentFormResult = {};

export function StudentStep({ tutorCodeLink }: { tutorCodeLink: string }) {
  const router = useRouter();
  const [added, setAdded] = useState(false);
  const [finishing, startFinish] = useTransition();
  const [state, formAction, pending] = useActionState(async (prev: StudentFormResult, formData: FormData) => {
    const result = await createStudentAction(prev, formData);
    if (!result.error) setAdded(true);
    return result;
  }, initialState);

  function finish() {
    startFinish(async () => {
      await ackOnboardingAction();
      router.push("/tutor");
      router.refresh();
    });
  }

  if (added) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          Added. Share your tutor code so the parent can join and see this student:
        </p>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-sunken px-4 py-3">
          <code className="flex-1 truncate text-sm">{tutorCodeLink}</code>
          <CopyButton value={tutorCodeLink} size="sm" />
        </div>
        <Button type="button" className="w-full" disabled={finishing} onClick={finish}>
          {finishing ? "Finishing…" : "Go to dashboard"}
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="student_name">Student name</Label>
        <Input id="student_name" name="student_name" placeholder="e.g. Maya Chen" autoFocus required />
      </div>
      <div>
        <Label htmlFor="payer_email">Payer email (optional)</Label>
        <Input id="payer_email" name="payer_email" type="email" placeholder="parent@email.com" />
      </div>

      {state.error && <p className="text-sm text-text">{state.error}</p>}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Adding…" : "Add student"}
      </Button>

      <Button type="button" variant="secondary" className="w-full" disabled={finishing} onClick={finish}>
        {finishing ? "Finishing…" : "Skip — go to dashboard"}
      </Button>
    </form>
  );
}
