"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldHint } from "@/components/ui/input";
import { confirmBookingLinkAction, type ConfirmBookingResult } from "@/app/book/[token]/actions";
import { formatBookingWhen } from "@/lib/scheduling";

const initialState: ConfirmBookingResult = {};

export function BookingConfirmForm({
  token,
  slots,
  needsStudentName,
}: {
  token: string;
  slots: { id: string; start_ts: string; duration_minutes: number }[];
  needsStudentName: boolean;
}) {
  const [slotId, setSlotId] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(confirmBookingLinkAction, initialState);

  if (state.bookingLinkId) {
    return (
      <div>
        <h2 className="mb-1 text-lg font-semibold">You&apos;re booked!</h2>
        <p className="text-sm text-text-secondary">
          We&apos;ve let your tutor know. They&apos;ll be in touch if anything changes.
        </p>
      </div>
    );
  }

  if (slots.length === 0) {
    return <p className="text-sm text-text-secondary">No times are currently offered on this link.</p>;
  }

  if (!slotId) {
    return (
      <div className="space-y-2">
        {slots.map((slot) => (
          <button
            key={slot.id}
            type="button"
            onClick={() => setSlotId(slot.id)}
            className="flex w-full items-center justify-between rounded-lg border border-border px-4 py-3 text-left text-sm hover:bg-hover"
          >
            <span>{formatBookingWhen(slot.start_ts)}</span>
            <span className="text-text-secondary">{slot.duration_minutes} min</span>
          </button>
        ))}
      </div>
    );
  }

  const chosen = slots.find((s) => s.id === slotId);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="slot_id" value={slotId} />

      <div className="rounded-lg border border-border bg-surface-sunken px-4 py-3 text-sm">
        {chosen && formatBookingWhen(chosen.start_ts)}
        <button
          type="button"
          onClick={() => setSlotId(null)}
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
