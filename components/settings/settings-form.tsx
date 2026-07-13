"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, FieldHint } from "@/components/ui/input";
import { updateTutorSettingsAction, type SettingsFormResult } from "@/app/tutor/settings/actions";
import type { Tables } from "@/lib/database.types";

const initialState: SettingsFormResult = {};

export function SettingsForm({ tutor }: { tutor: Tables<"tutors"> }) {
  const [state, formAction, pending] = useActionState(updateTutorSettingsAction, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" defaultValue={tutor.name} required />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="standard_rate_cents">Standard hourly rate ($)</Label>
          <Input
            id="standard_rate_cents"
            name="standard_rate_cents"
            type="number"
            step="0.01"
            min="0"
            defaultValue={(tutor.standard_rate_cents / 100).toFixed(2)}
            required
          />
          <FieldHint>Your default rate. Used for any student on the &quot;Standard&quot; rate type.</FieldHint>
        </div>
        <div>
          <Label htmlFor="travel_rate_cents">Default travel rate ($/hr, optional)</Label>
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
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="bill_travel_default"
          defaultChecked={tutor.bill_travel_default}
          className="h-4 w-4 rounded border-border"
        />
        Bill travel time by default (students can override this)
      </label>

      <div>
        <Label htmlFor="invoice_terms">Invoice terms</Label>
        <Select id="invoice_terms" name="invoice_terms" defaultValue={tutor.invoice_terms}>
          <option value="due_on_receipt">Due on receipt</option>
          <option value="net_7">Net 7</option>
          <option value="net_14">Net 14</option>
          <option value="net_30">Net 30</option>
        </Select>
      </div>

      {state.error && <p className="text-sm text-text">{state.error}</p>}
      {state.success && <p className="text-sm text-text-secondary">Saved.</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
