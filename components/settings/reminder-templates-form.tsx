"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, FieldHint } from "@/components/ui/input";
import { updateReminderTemplatesAction } from "@/app/tutor/settings/actions";
import type { SettingsFormResult } from "@/app/tutor/settings/actions";
import type { ReminderTemplates } from "@/lib/reminders";

const initialState: SettingsFormResult = {};

const INVOICE_SECTIONS = [
  { key: "offset_0", label: "Due today" },
  { key: "offset_3", label: "3 days late" },
  { key: "offset_7", label: "7 days late" },
] as const;

const SESSION_SECTIONS = [
  { key: "booking_confirmation", label: "Booking confirmation" },
  { key: "session_reminder", label: "Upcoming-session reminder" },
] as const;

export function ReminderTemplatesForm({ templates }: { templates: ReminderTemplates }) {
  const [state, formAction, pending] = useActionState(updateReminderTemplatesAction, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <FieldHint className="mt-0">
        Invoice reminders use {"{{student}}"}, {"{{tutor}}"}, {"{{amount}}"}, {"{{due_date}}"}, and{" "}
        {"{{link}}"}. Booking confirmations and session reminders use {"{{student}}"}, {"{{tutor}}"}, and{" "}
        {"{{when}}"} — all filled in automatically when a reminder goes out.
      </FieldHint>
      {INVOICE_SECTIONS.map((s) => (
        <div key={s.key} className="space-y-2 border-t border-border pt-4 first:border-t-0 first:pt-0">
          <h3 className="text-sm font-medium">{s.label}</h3>
          <div>
            <Label htmlFor={`${s.key}_subject`}>Subject</Label>
            <Input id={`${s.key}_subject`} name={`${s.key}_subject`} defaultValue={templates[s.key]?.subject} required />
          </div>
          <div>
            <Label htmlFor={`${s.key}_body`}>Body</Label>
            <Textarea id={`${s.key}_body`} name={`${s.key}_body`} defaultValue={templates[s.key]?.body} rows={3} required />
          </div>
        </div>
      ))}

      {SESSION_SECTIONS.map((s) => (
        <div key={s.key} className="space-y-2 border-t border-border pt-4">
          <h3 className="text-sm font-medium">{s.label}</h3>
          <div>
            <Label htmlFor={`${s.key}_subject`}>Subject</Label>
            <Input id={`${s.key}_subject`} name={`${s.key}_subject`} defaultValue={templates[s.key]?.subject} required />
          </div>
          <div>
            <Label htmlFor={`${s.key}_body`}>Body</Label>
            <Textarea id={`${s.key}_body`} name={`${s.key}_body`} defaultValue={templates[s.key]?.body} rows={3} required />
          </div>
        </div>
      ))}

      {state.error && <p className="text-sm text-text">{state.error}</p>}
      {state.success && <p className="text-sm text-text-secondary">Saved.</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save templates"}
      </Button>
    </form>
  );
}
