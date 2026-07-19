"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldHint } from "@/components/ui/input";
import { DateStrip } from "@/components/book/date-strip";
import { TimeSlotGrid } from "@/components/book/time-slot-grid";
import {
  confirmOpenBookingLinkAction,
  getOpenAvailabilitySlotsAction,
  type ConfirmOpenBookingResult,
} from "@/app/book/[token]/actions";
import { useSlotPicker } from "@/lib/hooks/use-slot-picker";
import { formatIsoSlotTime as formatTime } from "@/lib/scheduling";

const initialState: ConfirmOpenBookingResult = {};

export function OpenAvailabilityBookingForm({
  token,
  durationMinutes,
  needsStudentName,
}: {
  token: string;
  durationMinutes: number;
  needsStudentName: boolean;
}) {
  const {
    date,
    setDate,
    slots,
    selectedSlot,
    setSelectedSlot,
    pending: pendingSlots,
    error: slotsError,
    refetch,
  } = useSlotPicker((d) => getOpenAvailabilitySlotsAction(token, d), [token]);
  const [state, formAction, pending] = useActionState(confirmOpenBookingLinkAction, initialState);

  // A confirm failure most often means someone else just took this slot —
  // drop back to the picker with fresh data instead of leaving the same
  // now-invalid time selectable for an endless resubmit-and-fail loop.
  useEffect(() => {
    if (state.error) {
      setSelectedSlot(null);
      refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.error]);

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

  if (!selectedSlot) {
    return (
      <div className="space-y-4">
        <div>
          <Label>Pick a date</Label>
          <DateStrip value={date} onChange={setDate} />
        </div>
        {slotsError ? (
          <p className="text-sm text-text">{slotsError}</p>
        ) : pendingSlots ? (
          <p className="text-sm text-text-secondary">Loading times…</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-text-secondary">No open times that day — try another date.</p>
        ) : (
          <TimeSlotGrid slots={slots} onSelect={setSelectedSlot} />
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
