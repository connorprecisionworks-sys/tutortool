"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { CopyButton } from "@/components/ui/copy-button";
import { ShareButton } from "@/components/ui/share-button";
import { useToast } from "@/components/ui/toast";
import { createStudentAction, type StudentFormResult } from "@/app/tutor/students/actions";
import { ackOnboardingAction } from "@/app/onboarding/actions";

const initialState: StudentFormResult = {};

export function StudentStep({ tutorCodeLink }: { tutorCodeLink: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [added, setAdded] = useState(false);
  const [finishing, startFinish] = useTransition();
  const [state, formAction, pending] = useActionState(async (prev: StudentFormResult, formData: FormData) => {
    const result = await createStudentAction(prev, formData);
    if (!result.error) setAdded(true);
    return result;
  }, initialState);

  // E3 (build-queue.md): the moment this step flips to "added," the tutor
  // code shown below is exactly what they need to hand to the parent right
  // now — auto-copy it instead of waiting for the manual CopyButton click,
  // which stays as the fallback if the clipboard write is blocked.
  useEffect(() => {
    if (!added) return;
    (async () => {
      try {
        await navigator.clipboard.writeText(tutorCodeLink);
        toast("Code copied — share it with the parent", { variant: "success" });
      } catch {
        toast("Student added — copy the code below to share it");
      }
    })();
  }, [added, tutorCodeLink, toast]);

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
          <code className="min-w-0 flex-1 truncate text-sm">{tutorCodeLink}</code>
          <CopyButton value={tutorCodeLink} size="sm" />
          <ShareButton title="Join me on Slate" text="Use this link to join and see your child's sessions." url={tutorCodeLink} />
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
