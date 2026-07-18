"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { Label, Input } from "@/components/ui/input";
import {
  addAvailabilityAction,
  removeAvailabilityAction,
  type AvailabilityFormResult,
} from "@/app/tutor/schedule/actions";
import type { Tables } from "@/lib/database.types";
import { WEEKDAY_LABELS, formatTimeOfDay } from "@/lib/scheduling";

const initialState: AvailabilityFormResult = {};

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_MF = [1, 2, 3, 4, 5];
const WEEKENDS = [0, 6];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function RemoveButton({ availabilityId, onRemoved }: { availabilityId: string; onRemoved?: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Remove this availability window?")) return;
        startTransition(async () => {
          await removeAvailabilityAction(availabilityId);
          router.refresh();
          onRemoved?.();
        });
      }}
      className="text-xs text-text-tertiary hover:text-text disabled:opacity-50"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}

export function AvailabilityManager({
  availability,
  onChange,
  compact,
}: {
  availability: Tables<"availability">[];
  onChange?: () => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const [selectedDays, setSelectedDays] = useState<number[]>(WEEKDAYS_MF);
  const [state, formAction, pending] = useActionState(async (prev: AvailabilityFormResult, formData: FormData) => {
    const result = await addAvailabilityAction(prev, formData);
    if (!result.error) {
      router.refresh();
      onChange?.();
    }
    return result;
  }, initialState);

  const byWeekday = WEEKDAY_LABELS.map((label, weekday) => ({
    weekday,
    label,
    windows: availability.filter((a) => a.weekday === weekday).sort((a, b) => a.start_time.localeCompare(b.start_time)),
  }));

  function toggleDay(day: number) {
    setSelectedDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  return (
    <div className="space-y-4">
      {availability.length === 0 ? (
        <p className="text-sm text-text-secondary">
          No open hours yet. Set a weekly range below so bookings can be offered against it.
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
                      <RemoveButton availabilityId={w.id} onRemoved={onChange} />
                    </span>
                  ))}
                </div>
              </li>
            ))}
        </ul>
      )}

      <form action={formAction} className="space-y-3 border-t border-border pt-4">
        <div>
          <Label>Days</Label>
          <div className="mb-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedDays(WEEKDAYS_MF)}
              className="rounded-lg border border-border px-2.5 py-1 text-xs text-text-secondary hover:bg-hover"
            >
              Mon–Fri
            </button>
            <button
              type="button"
              onClick={() => setSelectedDays(WEEKENDS)}
              className="rounded-lg border border-border px-2.5 py-1 text-xs text-text-secondary hover:bg-hover"
            >
              Weekends
            </button>
            <button
              type="button"
              onClick={() => setSelectedDays(ALL_DAYS)}
              className="rounded-lg border border-border px-2.5 py-1 text-xs text-text-secondary hover:bg-hover"
            >
              Every day
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_SHORT.map((label, day) => {
              const active = selectedDays.includes(day);
              return (
                <label
                  key={day}
                  className={clsx(
                    "flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg border px-2 text-xs font-medium transition-colors",
                    active
                      ? "border-accent bg-accent text-accent-text"
                      : "border-border text-text-secondary hover:bg-hover"
                  )}
                >
                  <input
                    type="checkbox"
                    name="weekday"
                    value={day}
                    checked={active}
                    onChange={() => toggleDay(day)}
                    className="sr-only"
                  />
                  {label}
                </label>
              );
            })}
          </div>
        </div>

        <div className={clsx("flex flex-wrap items-end gap-3", compact && "flex-col items-stretch")}>
          <div>
            <Label htmlFor="start_time">Start</Label>
            <Input id="start_time" name="start_time" type="time" defaultValue="15:00" required />
          </div>
          <div>
            <Label htmlFor="end_time">End</Label>
            <Input id="end_time" name="end_time" type="time" defaultValue="18:00" required />
          </div>
          <Button type="submit" variant="secondary" disabled={pending || selectedDays.length === 0}>
            {pending ? "Saving…" : "Apply to selected days"}
          </Button>
        </div>
        {state.error && <p className="text-sm text-text">{state.error}</p>}
      </form>
    </div>
  );
}
