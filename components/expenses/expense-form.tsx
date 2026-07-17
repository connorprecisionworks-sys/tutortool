"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea, FieldHint } from "@/components/ui/input";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from "@/lib/expenses";
import type { ExpenseFormResult } from "@/app/tutor/expenses/actions";
import type { Tables } from "@/lib/database.types";

type Expense = Tables<"expenses">;
type StudentOption = { id: string; student_name: string };
type SessionOption = { id: string; occurred_on: string; travel_minutes: number };

const initialState: ExpenseFormResult = {};

export function ExpenseForm({
  expense,
  students,
  sessions,
  mileageRateCents,
  action,
  onSuccessPath,
  defaultCategory,
  defaultSessionId,
}: {
  expense?: Expense;
  students: StudentOption[];
  sessions: SessionOption[];
  mileageRateCents: number;
  action: (prev: ExpenseFormResult, formData: FormData) => Promise<ExpenseFormResult>;
  onSuccessPath: string;
  defaultCategory?: string;
  defaultSessionId?: string;
}) {
  const router = useRouter();
  const [category, setCategory] = useState<ExpenseCategory>(
    (expense?.category as ExpenseCategory) ?? (defaultCategory as ExpenseCategory) ?? "supplies"
  );
  const [milesInput, setMilesInput] = useState(expense?.miles != null ? String(expense.miles) : "");
  const [state, formAction, pending] = useActionState(async (prev: ExpenseFormResult, formData: FormData) => {
    const result = await action(prev, formData);
    if (!result.error) {
      router.push(onSuccessPath);
      router.refresh();
    }
    return result;
  }, initialState);

  const isMileage = category === "mileage";
  const estimatedAmount = isMileage && milesInput ? (Number(milesInput) * mileageRateCents) / 100 : null;

  return (
    <form action={formAction} className="space-y-6">
      {expense && <input type="hidden" name="id" value={expense.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="category">Category</Label>
          <Select
            id="category"
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {EXPENSE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="incurred_on">Date</Label>
          <Input
            id="incurred_on"
            name="incurred_on"
            type="date"
            defaultValue={expense?.incurred_on ?? new Date().toISOString().slice(0, 10)}
            required
          />
        </div>
      </div>

      {isMileage ? (
        <div className="border-t border-border pt-6">
          <h2 className="mb-4 text-sm font-semibold">Trip</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="miles">Miles driven</Label>
              <Input
                id="miles"
                name="miles"
                type="number"
                step="0.1"
                min="0"
                value={milesInput}
                onChange={(e) => setMilesInput(e.target.value)}
                required
              />
              <FieldHint>
                At ${(mileageRateCents / 100).toFixed(2)}/mi
                {estimatedAmount != null ? ` — ${estimatedAmount.toLocaleString("en-US", { style: "currency", currency: "USD" })}` : ""}
                . Change the rate in Settings.
              </FieldHint>
            </div>
            <div>
              <Label htmlFor="purpose">Purpose</Label>
              <Input id="purpose" name="note" defaultValue={expense?.note ?? ""} placeholder="e.g. Drive to session" />
            </div>
            <div>
              <Label htmlFor="from_location">From (optional)</Label>
              <Input id="from_location" name="from_location" defaultValue={expense?.from_location ?? ""} />
            </div>
            <div>
              <Label htmlFor="to_location">To (optional)</Label>
              <Input id="to_location" name="to_location" defaultValue={expense?.to_location ?? ""} />
            </div>
          </div>
          {sessions.length > 0 && (
            <div className="mt-4">
              <Label htmlFor="session_id">Related session (optional)</Label>
              <Select id="session_id" name="session_id" defaultValue={expense?.session_id ?? defaultSessionId ?? ""}>
                <option value="">None</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.occurred_on} — {s.travel_minutes} min travel logged
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="amount">Amount ($)</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0"
              defaultValue={expense && expense.category !== "mileage" ? (expense.amount_cents / 100).toFixed(2) : ""}
              required
            />
          </div>
          <div>
            <Label htmlFor="vendor">Vendor</Label>
            <Input id="vendor" name="vendor" defaultValue={expense?.vendor ?? ""} placeholder="e.g. Staples" />
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="student_id">Student (optional)</Label>
        <Select id="student_id" name="student_id" defaultValue={expense?.student_id ?? ""}>
          <option value="">None</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.student_name}
            </option>
          ))}
        </Select>
      </div>

      {!isMileage && (
        <div>
          <Label htmlFor="note">Note</Label>
          <Textarea id="note" name="note" defaultValue={expense?.note ?? ""} rows={3} />
        </div>
      )}

      <div>
        <Label htmlFor="receipt">Receipt (optional)</Label>
        <input
          id="receipt"
          name="receipt"
          type="file"
          accept="image/*,application/pdf"
          className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-text hover:file:bg-hover"
        />
        {expense?.receipt_path && <FieldHint>A receipt is already attached. Choosing a new file replaces it.</FieldHint>}
      </div>

      {state.error && <p className="text-sm text-text">{state.error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : expense ? "Save changes" : "Add expense"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
