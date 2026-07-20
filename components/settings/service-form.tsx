"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import type { ServiceFormResult } from "@/app/tutor/settings/services/actions";
import type { Tables } from "@/lib/database.types";

type Service = Tables<"services">;

const initialState: ServiceFormResult = {};

export function ServiceForm({
  service,
  tutor,
  action,
  onSuccessPath,
}: {
  service?: Service;
  tutor: Tables<"tutors">;
  action: (prev: ServiceFormResult, formData: FormData) => Promise<ServiceFormResult>;
  onSuccessPath: string;
}) {
  const router = useRouter();
  const [duration, setDuration] = useState(service?.duration_minutes ?? 60);
  // Once the tutor types in Price directly, stop overwriting it — this only
  // ever auto-recomputes for a brand-new service; editing an existing one
  // keeps its saved price exactly as before.
  const [priceTouched, setPriceTouched] = useState(false);
  const [priceInput, setPriceInput] = useState(service ? (service.price_cents / 100).toFixed(2) : "");

  const computedPrice = !service ? (Math.round((tutor.standard_rate_cents * duration) / 60) / 100).toFixed(2) : null;
  const priceValue = service ? priceInput : priceTouched ? priceInput : (computedPrice ?? "");

  const [state, formAction, pending] = useActionState(async (prev: ServiceFormResult, formData: FormData) => {
    const result = await action(prev, formData);
    if (!result.error) {
      router.push(onSuccessPath);
      router.refresh();
    }
    return result;
  }, initialState);

  return (
    <form action={formAction} className="space-y-6">
      {service && <input type="hidden" name="id" value={service.id} />}

      <div>
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={service?.name}
          placeholder="e.g. Diagnostic assessment"
          // E5 (build-queue.md): create-only autofocus.
          autoFocus={!service}
          required
        />
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

      <div>
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea id="description" name="description" defaultValue={service?.description ?? ""} rows={3} />
      </div>

      {state.error && <p className="text-sm text-text">{state.error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : service ? "Save changes" : "Add service"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
