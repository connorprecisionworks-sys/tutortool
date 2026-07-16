"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, Label, FieldHint } from "@/components/ui/input";
import { cancelSessionAction } from "@/app/tutor/sessions/actions";

const NO_OVERRIDE = "";

export function CancelSessionButton({
  sessionId,
  isPackageSession = false,
}: {
  sessionId: string;
  isPackageSession?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [handling, setHandling] = useState(NO_OVERRIDE);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Cancel session
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-sunken p-4">
      <div>
        <Label htmlFor="cancel-handling">How should this be handled?</Label>
        <Select id="cancel-handling" value={handling} onChange={(e) => setHandling(e.target.value)}>
          <option value={NO_OVERRIDE}>Use my default (per Settings)</option>
          {/* A package session was paid for as part of a lump-sum package
              purchase — there's no separate per-session charge to refund,
              so "Refund" isn't offered here; picking the equivalent option
              below restores this session to the package's balance instead. */}
          <option value="rollover">{isPackageSession ? "Restore to the package" : "Roll over to a credit"}</option>
          {!isPackageSession && <option value="refund">Refund</option>}
          <option value="charge">{isPackageSession ? "Keep drawn from the package" : "Charge in full"}</option>
        </Select>
        {isPackageSession && (
          <FieldHint>This session was prepaid through a package — there&apos;s no separate charge to refund.</FieldHint>
        )}
      </div>
      {error && <p className="text-sm text-text">{error}</p>}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await cancelSessionAction(sessionId, handling || null);
              if (result.error) {
                setError(result.error);
                return;
              }
              router.refresh();
              setOpen(false);
            });
          }}
        >
          {pending ? "Cancelling…" : "Confirm cancellation"}
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
          Never mind
        </Button>
      </div>
    </div>
  );
}
