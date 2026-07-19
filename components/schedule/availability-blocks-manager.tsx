"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label, Input, FieldHint } from "@/components/ui/input";
import {
  addAvailabilityBlockAction,
  removeAvailabilityBlockAction,
  type AvailabilityBlockFormResult,
} from "@/app/tutor/schedule/actions";
import type { Tables } from "@/lib/database.types";

const initialState: AvailabilityBlockFormResult = {};

function formatBlockRange(startDate: string, endDate: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC" };
  const start = new Date(`${startDate}T00:00:00Z`).toLocaleDateString("en-US", opts);
  if (startDate === endDate) return start;
  const end = new Date(`${endDate}T00:00:00Z`).toLocaleDateString("en-US", opts);
  return `${start} – ${end}`;
}

function RemoveBlockButton({ blockId }: { blockId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Remove this blocked date?")) return;
        startTransition(async () => {
          await removeAvailabilityBlockAction(blockId);
          router.refresh();
        });
      }}
      className="text-xs text-text-tertiary hover:text-text disabled:opacity-50"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}

/** One-off unavailable dates/ranges (vacations, single-day closures) — layered on top of the recurring weekly availability above, not a replacement for it. */
export function AvailabilityBlocksManager({ blocks }: { blocks: Tables<"availability_blocks">[] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(async (prev: AvailabilityBlockFormResult, formData: FormData) => {
    const result = await addAvailabilityBlockAction(prev, formData);
    if (!result.error) router.refresh();
    return result;
  }, initialState);

  const sorted = [...blocks].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      {sorted.length === 0 ? (
        <p className="text-sm text-text-secondary">No blocked dates. Add a vacation or one-off closure below.</p>
      ) : (
        <ul className="divide-y divide-border">
          {sorted.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <div>
                <span className="font-medium">{formatBlockRange(b.start_date, b.end_date)}</span>
                {b.note && <span className="ml-2 text-text-secondary">{b.note}</span>}
              </div>
              <RemoveBlockButton blockId={b.id} />
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="space-y-3 border-t border-border pt-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="block_start_date">Start date</Label>
            <Input id="block_start_date" name="start_date" type="date" min={today} required />
          </div>
          <div>
            <Label htmlFor="block_end_date">End date (optional)</Label>
            <Input id="block_end_date" name="end_date" type="date" min={today} />
            <FieldHint>Leave blank for a single day.</FieldHint>
          </div>
        </div>
        <div>
          <Label htmlFor="block_note">Note (optional)</Label>
          <Input id="block_note" name="note" placeholder="e.g. Vacation" maxLength={100} />
        </div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Block these dates"}
        </Button>
        {state.error && <p className="text-sm text-text">{state.error}</p>}
      </form>
    </div>
  );
}
