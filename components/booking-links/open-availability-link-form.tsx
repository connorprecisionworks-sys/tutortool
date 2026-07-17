"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, FieldHint } from "@/components/ui/input";
import { CopyButton } from "@/components/ui/copy-button";
import { createOpenAvailabilityBookingLinkAction } from "@/app/tutor/booking-links/actions";
import type { BookingLinkFormResult } from "@/app/tutor/booking-links/actions";
import { bookingLink } from "@/lib/booking-link";
import { formatCents } from "@/lib/money";
import type { Tables } from "@/lib/database.types";

type Client = Tables<"clients">;
type Service = Tables<"services">;

const initialState: BookingLinkFormResult = {};
const OPEN_LINK = "";
const NO_SERVICE = "";

export function OpenAvailabilityLinkForm({
  clients,
  services,
  hasAvailability,
}: {
  clients: Client[];
  services: Service[];
  hasAvailability: boolean;
}) {
  const [studentId, setStudentId] = useState(OPEN_LINK);
  const [serviceId, setServiceId] = useState(NO_SERVICE);
  const [state, formAction, pending] = useActionState(createOpenAvailabilityBookingLinkAction, initialState);

  if (state.token) {
    const link = bookingLink(state.token);
    return (
      <div className="space-y-4">
        <p className="text-sm text-text">
          Standing link created. Anyone with it can pick any open time on your calendar, any number of times.
        </p>
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

  if (!hasAvailability) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-text-secondary">
          Set your weekly availability first — a standing link needs open hours to offer.
        </p>
        <Link href="/tutor/schedule">
          <Button variant="secondary">Go to Schedule</Button>
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <Label htmlFor="student_id">For</Label>
        <Select id="student_id" name="student_id" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          <option value={OPEN_LINK}>Open — any new parent</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.student_name}
            </option>
          ))}
        </Select>
        <FieldHint>An open link is what you&apos;d share on your public profile or with a new family.</FieldHint>
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

      <div>
        <Label htmlFor="buffer_minutes">Buffer between sessions (minutes)</Label>
        <Input id="buffer_minutes" name="buffer_minutes" type="number" min="0" step="1" defaultValue={0} />
        <FieldHint>Keeps this much time clear before and after any existing session when offering times.</FieldHint>
      </div>

      {state.error && <p className="text-sm text-text">{state.error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create standing link"}
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
