"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldHint } from "@/components/ui/input";
import { updateOnboardingRateAction, type OnboardingRateFormResult } from "@/app/onboarding/actions";
import type { Tables } from "@/lib/database.types";

const initialState: OnboardingRateFormResult = {};

export function RateStep({ tutor, nextHref }: { tutor: Tables<"tutors">; nextHref: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(async (prev: OnboardingRateFormResult, formData: FormData) => {
    const result = await updateOnboardingRateAction(prev, formData);
    if (!result.error) router.push(nextHref);
    return result;
  }, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="standard_rate_cents">Standard hourly rate ($)</Label>
        <Input
          id="standard_rate_cents"
          name="standard_rate_cents"
          type="number"
          step="0.01"
          min="0.01"
          defaultValue={tutor.standard_rate_cents > 0 ? (tutor.standard_rate_cents / 100).toFixed(2) : ""}
          placeholder="60.00"
          autoFocus
          required
        />
        <FieldHint>Your default rate. Every student inherits it unless you set a custom rate for them.</FieldHint>
      </div>

      <div>
        <Label htmlFor="travel_rate_cents">Travel rate ($/hr, optional)</Label>
        <Input
          id="travel_rate_cents"
          name="travel_rate_cents"
          type="number"
          step="0.01"
          min="0"
          defaultValue={tutor.travel_rate_cents != null ? (tutor.travel_rate_cents / 100).toFixed(2) : ""}
          placeholder="Same as session rate"
        />
        <FieldHint>Leave blank to bill travel at the same rate as the session.</FieldHint>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="bill_travel_default"
          defaultChecked={tutor.bill_travel_default}
          className="h-4 w-4 rounded border-border"
        />
        Bill travel time by default
      </label>

      {state.error && <p className="text-sm text-text">{state.error}</p>}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}
