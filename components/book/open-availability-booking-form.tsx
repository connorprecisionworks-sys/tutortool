"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldHint } from "@/components/ui/input";
import {
  confirmOpenBookingLinkAction,
  getOpenAvailabilitySlotsAction,
  type ConfirmOpenBookingResult,
} from "@/app/book/[token]/actions";

const initialState: ConfirmOpenBookingResult = {};

function tomorrowIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Formats an ISO timestamp's time-of-day only, reading UTC getters — same "wall clock stamped as UTC" convention as formatBookingWhen. */
function formatTime(iso: string): string {
  const d = new Date(iso);
  const hours24 = d.getUTCHours();
  const minutes = d.getUTCMinutes();
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
}

export function OpenAvailabilityBookingForm({
  token,
  durationMinutes,
  needsStudentName,
}: {
  token: string;
  durationMinutes: number;
  needsStudentName: boolean;
}) {
  const [date, setDate] = useState(tomorrowIso());
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [pendingSlots, startSlotsTransition] = useTransition();
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(confirmOpenBookingLinkAction, initialState);

  useEffect(() => {
    startSlotsTransition(async () => {
      setSelectedSlot(null);
      setSlotsError(null);
      const result = await getOpenAvailabilitySlotsAction(token, date);
      if (result.error) setSlotsError(result.error);
      setSlots(result.slots);
    });
  }, [date, token]);

  if (state.sessionId) {
    return (
      <div>
        <h2 className="mb-1 text-lg font-semibold">You&apos;re booked!</h2>
        <p className="text-sm text-text-secondary">
          We&apos;ve let your tutor know. They&apos;ll be in touch if anything changes.
        </p>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  if (!selectedSlot) {
    return (
      <div className="space-y-4">
        <div>
          <Label htmlFor="pick_date">Pick a date</Label>
          <Input id="pick_date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {slotsError ? (
          <p className="text-sm text-text">{slotsError}</p>
        ) : pendingSlots ? (
          <p className="text-sm text-text-secondary">Loading times…</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-text-secondary">No open times that day — try another date.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {slots.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSelectedSlot(s)}
                className="rounded-lg border border-border px-4 py-3 text-center text-sm hover:bg-hover"
              >
                {formatTime(s)}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="start_ts" value={selectedSlot} />

      <div className="rounded-lg border border-border bg-surface-sunken px-4 py-3 text-sm">
        {new Date(date + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" })}
        {", "}
        {formatTime(selectedSlot)} ({durationMinutes} min)
        <button
          type="button"
          onClick={() => setSelectedSlot(null)}
          className="ml-2 text-xs text-text-tertiary underline hover:text-text"
        >
          Change
        </button>
      </div>

      {needsStudentName && (
        <div>
          <Label htmlFor="student_name">Student&apos;s name</Label>
          <Input id="student_name" name="student_name" required />
        </div>
      )}

      <div>
        <Label htmlFor="parent_name">Your name</Label>
        <Input id="parent_name" name="parent_name" />
      </div>

      <div>
        <Label htmlFor="parent_email">Your email</Label>
        <Input id="parent_email" name="parent_email" type="email" required />
        <FieldHint>We&apos;ll pass this to your tutor so they can reach you.</FieldHint>
      </div>

      {state.error && <p className="text-sm text-text">{state.error}</p>}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Booking…" : "Confirm booking"}
      </Button>
    </form>
  );
}
