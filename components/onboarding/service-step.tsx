"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldHint } from "@/components/ui/input";
import { createServiceAction, type ServiceFormResult } from "@/app/tutor/settings/services/actions";

const initialState: ServiceFormResult = {};

export function ServiceStep({ nextHref }: { nextHref: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(async (prev: ServiceFormResult, formData: FormData) => {
    const result = await createServiceAction(prev, formData);
    if (!result.error) router.push(nextHref);
    return result;
  }, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="name">Service name</Label>
        <Input id="name" name="name" defaultValue="Tutoring session" autoFocus required />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="duration_minutes">Duration (minutes)</Label>
          <Input id="duration_minutes" name="duration_minutes" type="number" min="1" step="1" defaultValue={60} required />
        </div>
        <div>
          <Label htmlFor="price_cents">Price ($)</Label>
          <Input id="price_cents" name="price_cents" type="number" min="0" step="0.01" placeholder="60.00" required />
        </div>
      </div>

      <FieldHint>You can add more services, or edit this one, any time in Settings.</FieldHint>

      {state.error && <p className="text-sm text-text">{state.error}</p>}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}
