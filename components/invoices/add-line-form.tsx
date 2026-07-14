"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { addManualLineAction, type InvoiceFormResult } from "@/app/tutor/invoices/actions";

const initialState: InvoiceFormResult = {};

export function AddLineForm({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(async (prev: InvoiceFormResult, formData: FormData) => {
    const result = await addManualLineAction(prev, formData);
    if (!result.error) router.refresh();
    return result;
  }, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
      <input type="hidden" name="invoice_id" value={invoiceId} />
      <div className="min-w-[10rem] flex-1">
        <Label htmlFor="description">Add a line</Label>
        <Input id="description" name="description" placeholder="e.g. Workbook materials" required />
      </div>
      <div className="w-28">
        <Label htmlFor="amount">Amount ($)</Label>
        <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required />
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Adding…" : "Add"}
      </Button>
      {state.error && <p className="w-full text-sm text-text">{state.error}</p>}
    </form>
  );
}
