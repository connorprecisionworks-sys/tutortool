"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, Label } from "@/components/ui/input";
import { endRecurringSeriesAction } from "@/app/tutor/sessions/recurring/actions";

const NO_OVERRIDE = "";

export function EndSeriesButton({
  recurringSessionId,
  fromDate,
  label = "Cancel this and future",
}: {
  recurringSessionId: string;
  fromDate: string;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [handling, setHandling] = useState(NO_OVERRIDE);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ cancelled: number; skipped: number } | null>(null);

  if (result) {
    return (
      <p className="text-xs text-text-secondary">
        Series ended — {result.cancelled} upcoming session{result.cancelled === 1 ? "" : "s"} cancelled
        {result.skipped > 0 ? `, ${result.skipped} left as-is (already billed)` : ""}.
      </p>
    );
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-sunken p-4">
      <div>
        <Label htmlFor={`end-series-handling-${recurringSessionId}`}>
          How should upcoming sessions from {fromDate} on be handled?
        </Label>
        <Select
          id={`end-series-handling-${recurringSessionId}`}
          value={handling}
          onChange={(e) => setHandling(e.target.value)}
        >
          <option value={NO_OVERRIDE}>Use my default (per Settings)</option>
          <option value="rollover">Roll over to a credit</option>
          <option value="refund">Refund</option>
          <option value="charge">Charge in full</option>
        </Select>
      </div>
      {error && <p className="text-sm text-text">{error}</p>}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const outcome = await endRecurringSeriesAction(recurringSessionId, fromDate, handling || null);
              if (outcome.error) {
                setError(outcome.error);
                return;
              }
              setResult({ cancelled: outcome.cancelled ?? 0, skipped: outcome.skipped ?? 0 });
              router.refresh();
            });
          }}
        >
          {pending ? "Ending…" : "Confirm — end series"}
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
          Never mind
        </Button>
      </div>
    </div>
  );
}
