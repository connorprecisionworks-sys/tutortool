"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label, Select, FieldHint } from "@/components/ui/input";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/date";
import { updateAutoInvoiceSettingsAction, type AutoInvoiceFormResult } from "@/app/tutor/students/auto-invoice-actions";

const initialState: AutoInvoiceFormResult = {};

const TRIGGER_LABELS: Record<string, string> = {
  weekly: "Weekly — bill unbilled sessions every 7 days",
  after_session: "After each session — bill right after logging one",
  package_depleted: "When a package runs out — sweep up anything unbilled",
};

export function AutoInvoiceSettingsCard({
  clientId,
  enabled: initialEnabled,
  trigger: initialTrigger,
  nextDate,
  previewCount,
  previewTotalCents,
  resendConfigured,
}: {
  clientId: string;
  enabled: boolean;
  trigger: string;
  nextDate: string | null;
  previewCount: number;
  previewTotalCents: number;
  resendConfigured: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [trigger, setTrigger] = useState(initialTrigger);
  const [state, formAction, pending] = useActionState(updateAutoInvoiceSettingsAction, initialState);

  return (
    <Card className="max-w-2xl">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Auto-invoicing</h2>
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${enabled ? "text-text" : "text-text-tertiary"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${enabled ? "bg-accent" : "bg-border-strong"}`} />
          {enabled ? "On" : "Off"}
        </span>
      </div>
      <p className="mb-4 text-xs text-text-tertiary">
        Automatically generate and send an invoice for this student. Off by default — Slate never invoices a
        student who hasn&apos;t been explicitly turned on here.
      </p>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="client_id" value={clientId} />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="auto_invoice_enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Turn on auto-invoicing for this student
        </label>

        {enabled && (
          <div>
            <Label htmlFor="auto_invoice_trigger">When to invoice</Label>
            <Select
              id="auto_invoice_trigger"
              name="auto_invoice_trigger"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
            >
              {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            {trigger === "weekly" && (
              <FieldHint>{nextDate ? `Next auto-invoice: ${formatDate(nextDate)}` : "Saving turns this on starting next week."}</FieldHint>
            )}
            {!resendConfigured && (
              <FieldHint>
                Resend isn&apos;t configured yet — invoices will still generate and send on schedule, but the
                parent email will only be logged, not delivered, until it is.
              </FieldHint>
            )}
          </div>
        )}

        {state.error && <p className="text-sm text-text">{state.error}</p>}

        <Button type="submit" disabled={pending} variant="secondary" size="sm">
          {pending ? "Saving…" : "Save"}
        </Button>
      </form>

      <div className="mt-4 border-t border-border pt-4">
        <h3 className="mb-1 text-xs font-semibold text-text-secondary">Preview — if generated right now</h3>
        {previewCount === 0 ? (
          <p className="text-sm text-text-tertiary">No unbilled sessions yet — nothing would be invoiced.</p>
        ) : (
          <p className="text-sm">
            {previewCount} unbilled session{previewCount === 1 ? "" : "s"} — {formatCents(previewTotalCents)}
          </p>
        )}
      </div>
    </Card>
  );
}
