"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, FieldHint } from "@/components/ui/input";
import { CopyButton } from "@/components/ui/copy-button";
import { ShareButton } from "@/components/ui/share-button";
import { useToast } from "@/components/ui/toast";
import { createBookingLinkAction, type BookingLinkFormResult } from "@/app/tutor/booking-links/actions";
import { bookingLink } from "@/lib/booking-link";
import { formatCents } from "@/lib/money";
import type { Tables } from "@/lib/database.types";

type Client = Tables<"clients">;
type Service = Tables<"services">;

const initialState: BookingLinkFormResult = {};
const OPEN_LINK = "";
const NO_SERVICE = "";
// Long enough for the "copied" toast to register before the view changes
// out from under it (per E3's build-queue.md spec of ~1.2-1.5s).
const AUTO_RETURN_MS = 1300;

interface SlotRow {
  key: number;
  date: string;
  time: string;
}

export function BookingLinkForm({ clients, services }: { clients: Client[]; services: Service[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [studentId, setStudentId] = useState(OPEN_LINK);
  const [serviceId, setServiceId] = useState(NO_SERVICE);
  const [nextKey, setNextKey] = useState(1);
  // Prefill the first slot's date to tomorrow (matching the app's existing
  // `new Date().toISOString().slice(0, 10)` local-date convention, e.g.
  // components/expenses/expense-form.tsx) rather than leaving it blank —
  // cuts one required field's typing without guessing a time.
  const [slots, setSlots] = useState<SlotRow[]>(() => [
    { key: 0, date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10), time: "" },
  ]);
  const [state, formAction, pending] = useActionState(createBookingLinkAction, initialState);
  const copiedRef = useRef(false);

  // E3 (build-queue.md): the moment createBookingLinkAction returns a
  // token, the link is "just generated" — auto-copy it and collapse the
  // old create-then-copy-then-Done sequence into one action's worth of
  // effect. copiedRef guards against firing twice (React 18 dev-mode
  // double-invoke, or a re-render before the redirect below fires).
  useEffect(() => {
    if (!state.token || copiedRef.current) return;
    copiedRef.current = true;
    const link = bookingLink(state.token);
    (async () => {
      try {
        await navigator.clipboard.writeText(link);
        toast("Link copied — send it to the parent", { variant: "success" });
      } catch {
        toast("Link created — copy it below to send to the parent");
      }
    })();
    const timer = setTimeout(() => router.push("/tutor/booking-links"), AUTO_RETURN_MS);
    return () => clearTimeout(timer);
  }, [state.token, toast, router]);

  if (state.token) {
    const link = bookingLink(state.token);
    return (
      <div className="space-y-4">
        <p className="text-sm text-text">
          Link created and copied — send it to the parent. Returning to Booking Links…
        </p>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-sunken px-4 py-3">
          <code className="min-w-0 flex-1 truncate text-sm">{link}</code>
          <CopyButton value={link} />
          <ShareButton title="Book a session" text="Pick a time that works for you:" url={link} />
        </div>
        <Link href="/tutor/booking-links" className="text-sm text-text-secondary hover:text-text">
          Back to Booking Links now
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
        <Select
          id="student_id"
          name="student_id"
          value={studentId}
          // E5 (build-queue.md): this form is create-only.
          autoFocus
          onChange={(e) => setStudentId(e.target.value)}
        >
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
