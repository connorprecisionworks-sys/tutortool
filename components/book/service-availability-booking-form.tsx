"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldHint } from "@/components/ui/input";
import {
  confirmPublicServiceBookingAction,
  getPublicServiceSlotsAction,
  type ConfirmPublicServiceBookingResult,
} from "@/app/t/[handle]/book/[serviceId]/actions";
import { useSlotPicker } from "@/lib/hooks/use-slot-picker";
import { formatIsoSlotTime as formatTime } from "@/lib/scheduling";

const initialState: ConfirmPublicServiceBookingResult = {};

export function ServiceAvailabilityBookingForm({
  handle,
  serviceId,
  durationMinutes,
}: {
  handle: string;
  serviceId: string;
  durationMinutes: number;
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
  } = useSlotPicker((d) => getPublicServiceSlotsAction(handle, serviceId, d), [handle, serviceId]);
  const [state, formAction, pending] = useActionState(confirmPublicServiceBookingAction, initialState);

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
      <input type="hidden" name="handle" value={handle} />
      <input type="hidden" name="service_id" value={serviceId} />
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

      <div>
        <Label htmlFor="student_name">Student&apos;s name</Label>
        <Input id="student_name" name="student_name" required />
      </div>

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
