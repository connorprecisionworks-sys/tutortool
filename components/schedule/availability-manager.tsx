"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label, Select, Input } from "@/components/ui/input";
import {
  addAvailabilityAction,
  removeAvailabilityAction,
  type AvailabilityFormResult,
} from "@/app/tutor/schedule/actions";
import type { Tables } from "@/lib/database.types";
import { WEEKDAY_LABELS, formatTimeOfDay } from "@/lib/scheduling";

const initialState: AvailabilityFormResult = {};

function RemoveButton({ availabilityId }: { availabilityId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await removeAvailabilityAction(availabilityId);
          router.refresh();
        });
      }}
      className="text-xs text-text-tertiary hover:text-text disabled:opacity-50"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}

export function AvailabilityManager({ availability }: { availability: Tables<"availability">[] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(async (prev: AvailabilityFormResult, formData: FormData) => {
    const result = await addAvailabilityAction(prev, formData);
    if (!result.error) router.refresh();
    return result;
  }, initialState);

  const byWeekday = WEEKDAY_LABELS.map((label, weekday) => ({
    weekday,
    label,
    windows: availability.filter((a) => a.weekday === weekday).sort((a, b) => a.start_time.localeCompare(b.start_time)),
  }));

  return (
    <div className="space-y-4">
      {availability.length === 0 ? (
        <p className="text-sm text-text-secondary">
          No open hours yet. Add a weekly window below so parents in Request or Calendar mode can book against it.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {byWeekday
            .filter((d) => d.windows.length > 0)
            .map((d) => (
              <li key={d.weekday} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="font-medium">{d.label}</span>
                <div className="flex flex-wrap items-center gap-3">
                  {d.windows.map((w) => (
                    <span key={w.id} className="flex items-center gap-2 text-text-secondary">
                      {formatTimeOfDay(w.start_time)}–{formatTimeOfDay(w.end_time)}
                      <RemoveButton availabilityId={w.id} />
                    </span>
                  ))}
                </div>
              </li>
            ))}
        </ul>
      )}

      <form action={formAction} className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
        <div>
          <Label htmlFor="weekday">Day</Label>
          <Select id="weekday" name="weekday" defaultValue="1">
            {WEEKDAY_LABELS.map((label, i) => (
              <option key={i} value={i}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="start_time">Start</Label>
          <Input id="start_time" name="start_time" type="time" defaultValue="15:00" required />
        </div>
        <div>
          <Label htmlFor="end_time">End</Label>
          <Input id="end_time" name="end_time" type="time" defaultValue="18:00" required />
        </div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Adding…" : "Add window"}
        </Button>
      </form>
      {state.error && <p className="text-sm text-text">{state.error}</p>}
    </div>
  );
}
