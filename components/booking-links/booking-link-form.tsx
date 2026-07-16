"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, FieldHint } from "@/components/ui/input";
import { CopyButton } from "@/components/ui/copy-button";
import { createBookingLinkAction, type BookingLinkFormResult } from "@/app/tutor/booking-links/actions";
import { bookingLink } from "@/lib/booking-link";
import { formatCents } from "@/lib/money";
import type { Tables } from "@/lib/database.types";

type Client = Tables<"clients">;
type Service = Tables<"services">;

const initialState: BookingLinkFormResult = {};
const OPEN_LINK = "";
const NO_SERVICE = "";

interface SlotRow {
  key: number;
  date: string;
  time: string;
}

export function BookingLinkForm({ clients, services }: { clients: Client[]; services: Service[] }) {
  const [studentId, setStudentId] = useState(OPEN_LINK);
  const [serviceId, setServiceId] = useState(NO_SERVICE);
  const [nextKey, setNextKey] = useState(1);
  const [slots, setSlots] = useState<SlotRow[]>([{ key: 0, date: "", time: "" }]);
  const [state, formAction, pending] = useActionState(createBookingLinkAction, initialState);

  if (state.token) {
    const link = bookingLink(state.token);
    return (
      <div className="space-y-4">
        <p className="text-sm text-text">Link created. Send it to the parent — they pick a time, no account needed.</p>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-sunken px-4 py-3">
          <code className="flex-1 truncate text-sm">{link}</code>
          <CopyButton value={link} />
        </div>
        <Link href="/tutor/booking-links">
          <Button variant="secondary">Done</Button>
        </Link>
      </div>
    );
  }

  function addSlot() {
    setSlots((prev) => [...prev, { key: nextKey, date: "", time: "" }]);
    setNextKey((k) => k + 1);
  }

  function removeSlot(key: number) {
    setSlots((prev) => (prev.length > 1 ? prev.filter((s) => s.key !== key) : prev));
  }

  function updateSlot(key: number, field: "date" | "time", value: string) {
    setSlots((prev) => prev.map((s) => (s.key === key ? { ...s, [field]: value } : s)));
  }

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <Label htmlFor="student_id">For</Label>
        <Select id="student_id" name="student_id" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          <option value={OPEN_LINK}>Open — a new parent I haven&apos;t added yet</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.student_name}
            </option>
          ))}
        </Select>
        <FieldHint>
          {studentId
            ? "The parent confirms with their name and email — it fills in this student's payer contact."
            : "The parent enters their child's name, and their own name and email, when they confirm."}
        </FieldHint>
      </div>

      <div>
        <Label htmlFor="service_id">Service (optional)</Label>
        <Select id="service_id" name="service_id" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          <option value={NO_SERVICE}>None — set a duration below</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {formatCents(s.price_cents)} ({s.duration_minutes} min)
            </option>
          ))}
        </Select>
      </div>

      {!serviceId && (
        <div>
          <Label htmlFor="duration_minutes">Session duration (minutes)</Label>
          <Input id="duration_minutes" name="duration_minutes" type="number" min="1" step="1" defaultValue={60} required />
        </div>
      )}

      <div className="border-t border-border pt-6">
        <h2 className="mb-3 text-sm font-semibold">Offered times</h2>
        <div className="space-y-3">
          {slots.map((slot) => (
            <div key={slot.key} className="flex flex-wrap items-end gap-3">
              <div>
                <Label htmlFor={`slot-date-${slot.key}`}>Date</Label>
                <Input
                  id={`slot-date-${slot.key}`}
                  name="slot_date"
                  type="date"
                  value={slot.date}
                  onChange={(e) => updateSlot(slot.key, "date", e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor={`slot-time-${slot.key}`}>Time</Label>
                <Input
                  id={`slot-time-${slot.key}`}
                  name="slot_time"
                  type="time"
                  value={slot.time}
                  onChange={(e) => updateSlot(slot.key, "time", e.target.value)}
                  required
                />
              </div>
              {slots.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSlot(slot.key)}
                  className="mb-2.5 text-xs text-text-tertiary hover:text-text"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={addSlot}>
          Add another time
        </Button>
      </div>

      {state.error && <p className="text-sm text-text">{state.error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create link"}
        </Button>
        <Link href="/tutor/booking-links">
          <Button type="button" variant="secondary">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
