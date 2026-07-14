"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label, Input, Select } from "@/components/ui/input";
import { createBookingAction, type BookingFormResult } from "@/app/parent/schedule/actions";
import type { Tables } from "@/lib/database.types";
import { WEEKDAY_LABELS, formatTimeOfDay } from "@/lib/scheduling";

const initialState: BookingFormResult = {};

export function BookingRequestForm({
  studentId,
  mode,
  availability,
}: {
  studentId: string;
  mode: "request" | "calendar";
  availability: Tables<"availability">[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(async (prev: BookingFormResult, formData: FormData) => {
    const result = await createBookingAction(prev, formData);
    if (!result.error) router.refresh();
    return result;
  }, initialState);

  if (availability.length === 0) {
    return <p className="text-sm text-text-secondary">Your tutor hasn&apos;t opened any hours yet.</p>;
  }

  return (
    <div className="space-y-3">
      <ul className="text-sm text-text-secondary">
        {availability
          .slice()
          .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time))
          .map((w) => (
            <li key={w.id}>
              {WEEKDAY_LABELS[w.weekday]} {formatTimeOfDay(w.start_time)}–{formatTimeOfDay(w.end_time)}
            </li>
          ))}
      </ul>

      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="student_id" value={studentId} />
        <div>
          <Label htmlFor={`date-${studentId}`}>Date</Label>
          <Input id={`date-${studentId}`} name="date" type="date" required />
        </div>
        <div>
          <Label htmlFor={`time-${studentId}`}>Time</Label>
          <Input id={`time-${studentId}`} name="time" type="time" required />
        </div>
        <div>
          <Label htmlFor={`duration-${studentId}`}>Duration</Label>
          <Select id={`duration-${studentId}`} name="duration_minutes" defaultValue="60">
            <option value="30">30 min</option>
            <option value="45">45 min</option>
            <option value="60">60 min</option>
            <option value="90">90 min</option>
          </Select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : mode === "calendar" ? "Book slot" : "Request time"}
        </Button>
      </form>
      {state.error && <p className="text-sm text-text">{state.error}</p>}
    </div>
  );
}
