"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, FieldHint } from "@/components/ui/input";
import { createPackageAction, type PackageFormResult } from "@/app/tutor/packages/actions";
import type { Tables } from "@/lib/database.types";

const initialState: PackageFormResult = {};
const NO_SERVICE = "";

export function PackageForm({ clients, services }: { clients: Tables<"clients">[]; services: Tables<"services">[] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(async (prev: PackageFormResult, formData: FormData) => {
    const result = await createPackageAction(prev, formData);
    if (result.invoiceId) {
      router.push(`/tutor/invoices/${result.invoiceId}`);
      router.refresh();
    }
    return result;
  }, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <Label htmlFor="client_id">Student</Label>
        <Select id="client_id" name="client_id" defaultValue={clients[0]?.id}>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.student_name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="service_id">Service (optional)</Label>
        <Select id="service_id" name="service_id" defaultValue={NO_SERVICE}>
          <option value={NO_SERVICE}>None</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <FieldHint>Sessions logged against this package can optionally default to this service.</FieldHint>
      </div>

      <div>
        <Label htmlFor="name">Package name</Label>
        <Input id="name" name="name" placeholder="e.g. 4-Session Package" required />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="total_sessions">Total sessions</Label>
          <Input id="total_sessions" name="total_sessions" type="number" min="1" step="1" defaultValue={4} required />
        </div>
        <div>
          <Label htmlFor="price_cents">Price ($)</Label>
          <Input id="price_cents" name="price_cents" type="number" min="0" step="0.01" required />
        </div>
      </div>

      {state.error && <p className="text-sm text-text">{state.error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending || clients.length === 0}>
          {pending ? "Creating…" : "Create package & build invoice"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
