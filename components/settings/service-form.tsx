"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import type { ServiceFormResult } from "@/app/tutor/settings/services/actions";
import type { Tables } from "@/lib/database.types";

type Service = Tables<"services">;

const initialState: ServiceFormResult = {};

export function ServiceForm({
  service,
  action,
  onSuccessPath,
}: {
  service?: Service;
  action: (prev: ServiceFormResult, formData: FormData) => Promise<ServiceFormResult>;
  onSuccessPath: string;
}) {
  const router = useRouter();
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
            defaultValue={service?.duration_minutes ?? 60}
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
            defaultValue={service ? (service.price_cents / 100).toFixed(2) : ""}
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
