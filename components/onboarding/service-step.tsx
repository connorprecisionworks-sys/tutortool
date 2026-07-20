"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldHint } from "@/components/ui/input";
import { createServiceAction, type ServiceFormResult } from "@/app/tutor/settings/services/actions";
import type { Tables } from "@/lib/database.types";

const initialState: ServiceFormResult = {};

// E2 (build-queue.md): this onboarding step doesn't reuse
// components/settings/service-form.tsx (different copy/fields — no
// Cancel/description, "Continue" button, name defaults to "Tutoring
// session"), so it needs its own copy of ServiceForm's price-prefill logic
// rather than inheriting it for free. Found missing during the Batch 5 QA
// sweep: the tutor's standard rate is set one step earlier (rates step) but
// Price here was still blank, requiring a fully-typed re-entry of the same
// number. Mirrors ServiceForm's touched-latch exactly.
export function ServiceStep({ tutor, nextHref }: { tutor: Tables<"tutors">; nextHref: string }) {
  const router = useRouter();
  const [duration, setDuration] = useState(60);
  const [priceTouched, setPriceTouched] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const computedPrice = (Math.round((tutor.standard_rate_cents * duration) / 60) / 100).toFixed(2);
  const priceValue = priceTouched ? priceInput : computedPrice;

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
          <Input
            id="duration_minutes"
            name="duration_minutes"
            type="number"
            min="1"
            step="1"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            required
          />
        </div>
        <div>
          <Label htmlFor="price_cents">Price ($)</Label>
          <Input
            id="price_cents"
            name="price_cents"
            type="number"
            min="0"
            step="0.01"
            value={priceValue}
            onChange={(e) => {
              setPriceInput(e.target.value);
              setPriceTouched(true);
            }}
            required
          />
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
