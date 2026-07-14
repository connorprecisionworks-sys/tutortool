"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { sendReminderNowAction } from "@/app/tutor/invoices/reminder-actions";

const TEMPLATE_OPTIONS = [
  { value: "offset_0", label: "Due-today note" },
  { value: "offset_3", label: "3-day follow-up" },
  { value: "offset_7", label: "7-day follow-up" },
];

export function ReminderControls({ invoiceId, reminderCount }: { invoiceId: string; reminderCount: number }) {
  const router = useRouter();
  const [templateKey, setTemplateKey] = useState("offset_0");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  return (
    <div className="space-y-2">
      <p className="text-xs text-text-tertiary">
        {reminderCount > 0 ? `Reminded ${reminderCount}×` : "No reminders sent yet."}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={templateKey} onChange={(e) => setTemplateKey(e.target.value)} className="w-auto">
          {TEMPLATE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setSent(false);
              const result = await sendReminderNowAction(invoiceId, templateKey);
              if (result.error) {
                setError(result.error);
              } else {
                setError(null);
                setSent(true);
              }
              // Refresh either way — log_reminder runs (and reminderCount
              // can change) even when the email send itself failed.
              router.refresh();
            })
          }
        >
          {pending ? "Sending…" : "Send reminder now"}
        </Button>
      </div>
      {sent && <p className="text-xs text-text-secondary">Sent.</p>}
      {error && <p className="text-xs text-text">{error}</p>}
    </div>
  );
}
