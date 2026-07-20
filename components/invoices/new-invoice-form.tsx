"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { createDraftInvoiceAction, type InvoiceFormResult } from "@/app/tutor/invoices/actions";
import type { Tables } from "@/lib/database.types";

const initialState: InvoiceFormResult = {};

function firstOfMonth(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function NewInvoiceForm({ clients }: { clients: Tables<"clients">[] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(async (prev: InvoiceFormResult, formData: FormData) => {
    const result = await createDraftInvoiceAction(prev, formData);
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
        <Select id="client_id" name="client_id" defaultValue={clients[0]?.id} autoFocus>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.student_name}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="period_start">From</Label>
          <Input id="period_start" name="period_start" type="date" defaultValue={firstOfMonth()} required />
        </div>
        <div>
          <Label htmlFor="period_end">To</Label>
          <Input id="period_end" name="period_end" type="date" defaultValue={today()} required />
        </div>
      </div>

      <p className="text-xs text-text-tertiary">
        We&apos;ll bundle every unbilled session for this student in that range into a draft you can review
        before sending.
      </p>

      {state.error && <p className="text-sm text-text">{state.error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending || clients.length === 0}>
          {pending ? "Building draft…" : "Build draft"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
