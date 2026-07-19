"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import { addGatedResourceLineAction, type InvoiceFormResult } from "@/app/tutor/invoices/actions";
import { formatCents } from "@/lib/money";

const initialState: InvoiceFormResult = {};

export function AddGatedResourceForm({
  invoiceId,
  resources,
}: {
  invoiceId: string;
  resources: { id: string; title: string; price_cents: number }[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(async (prev: InvoiceFormResult, formData: FormData) => {
    const result = await addGatedResourceLineAction(prev, formData);
    if (!result.error) router.refresh();
    return result;
  }, initialState);

  if (resources.length === 0) return null;

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
      <input type="hidden" name="invoice_id" value={invoiceId} />
      <div className="min-w-[14rem] flex-1">
        <Label htmlFor="resource_id">Add a gated resource</Label>
        <Select id="resource_id" name="resource_id" required defaultValue="">
          <option value="" disabled>
            Choose a resource…
          </option>
          {resources.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title} — {formatCents(r.price_cents)}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Adding…" : "Add"}
      </Button>
      {state.error && <p className="w-full text-sm text-text">{state.error}</p>}
    </form>
  );
}
