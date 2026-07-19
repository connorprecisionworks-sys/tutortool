"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, FieldHint } from "@/components/ui/input";
import { updateTutorSettingsAction, type SettingsFormResult } from "@/app/tutor/settings/actions";
import type { Tables } from "@/lib/database.types";

const initialState: SettingsFormResult = {};

export function SettingsForm({ tutor, smsConfigured }: { tutor: Tables<"tutors">; smsConfigured: boolean }) {
  const [state, formAction, pending] = useActionState(updateTutorSettingsAction, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" defaultValue={tutor.name} required />
      </div>

      <div>
        <Label htmlFor="phone">Phone (optional)</Label>
        <Input id="phone" name="phone" type="tel" maxLength={30} defaultValue={tutor.phone ?? ""} placeholder="e.g. (555) 123-4567" />
        <FieldHint>
          Used for your own records and to prefill contact/SMS features. Not shown publicly unless you enable it
          below — changing the number here turns public visibility back off, so you re-confirm it for the new
          number.
        </FieldHint>
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

      <div>
        <Label htmlFor="default_payment_timing">Default payment timing</Label>
        <Select id="default_payment_timing" name="default_payment_timing" defaultValue={tutor.default_payment_timing}>
          <option value="pay_after">Pay after — bill once sessions have happened</option>
          <option value="pay_before">Pay before — due immediately, regardless of terms above</option>
        </Select>
        <FieldHint>Each invoice can override this when it&apos;s built.</FieldHint>
      </div>

      <div className="border-t border-border pt-6">
        <h2 className="mb-4 text-sm font-semibold">Cancellations</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="default_cancellation_policy">Default handling</Label>
            <Select id="default_cancellation_policy" name="default_cancellation_policy" defaultValue={tutor.default_cancellation_policy}>
              <option value="rollover">Roll over to a credit</option>
              <option value="refund">Refund</option>
              <option value="charge">Charge in full</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="cancellation_window_hours">Cancellation window (hours)</Label>
            <Input
              id="cancellation_window_hours"
              name="cancellation_window_hours"
              type="number"
              min="0"
              step="1"
              defaultValue={tutor.cancellation_window_hours}
            />
          </div>
        </div>
        <FieldHint>
          Cancelling inside the window (less notice than this) always charges in full. Outside it, your
          default handling applies — either can be overridden per cancellation.
        </FieldHint>
      </div>

      <div className="border-t border-border pt-6">
        <h2 className="mb-4 text-sm font-semibold">Session reminders</h2>
        <div>
          <Label htmlFor="session_reminder_lead_hours">Remind parents this many hours before a session</Label>
          <Input
            id="session_reminder_lead_hours"
            name="session_reminder_lead_hours"
            type="number"
            min="0"
            step="1"
            defaultValue={tutor.session_reminder_lead_hours}
          />
          <FieldHint>Sent once per session, along with a confirmation email as soon as it&apos;s booked.</FieldHint>
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <h2 className="mb-4 text-sm font-semibold">Mileage</h2>
        <div>
          <Label htmlFor="mileage_rate_cents">Mileage rate ($/mile)</Label>
          <Input
            id="mileage_rate_cents"
            name="mileage_rate_cents"
            type="number"
            step="0.001"
            min="0"
            defaultValue={(tutor.mileage_rate_cents / 100).toFixed(3)}
            required
          />
          <FieldHint>
            Used to value logged mileage trips in Expenses. Defaults to the IRS standard business rate —
            the IRS updates this yearly, so check and update it each January.
          </FieldHint>
        </div>
      </div>

      {smsConfigured && (
        <div className="border-t border-border pt-6">
          <h2 className="mb-4 text-sm font-semibold">SMS reminders</h2>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="sms_enabled"
              defaultChecked={tutor.sms_enabled}
              className="h-4 w-4 rounded border-border"
            />
            Also send reminders by text message
          </label>
          <FieldHint>
            Only sent to students with a phone number and SMS opt-in checked on their profile.
          </FieldHint>
        </div>
      )}

      {state.error && <p className="text-sm text-text">{state.error}</p>}
      {state.success && <p className="text-sm text-text-secondary">Saved.</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
