"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatBookingWhen } from "@/lib/scheduling";

export interface PendingBooking {
  id: string;
  student_name: string;
  requested_start: string;
  duration_minutes: number;
}

export function BookingRequests({
  bookings,
  approveAction,
  declineAction,
}: {
  bookings: PendingBooking[];
  approveAction: (bookingId: string) => Promise<{ error?: string }>;
  declineAction: (bookingId: string) => Promise<{ error?: string }>;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function respond(bookingId: string, action: (id: string) => Promise<{ error?: string }>) {
    setPendingId(bookingId);
    setError(null);
    startTransition(async () => {
      const result = await action(bookingId);
      setPendingId(null);
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  if (bookings.length === 0) {
    return <p className="text-sm text-text-secondary">No pending requests.</p>;
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-text">{error}</p>}
      <ul className="divide-y divide-border">
        {bookings.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <div>
              <p className="font-medium">{b.student_name}</p>
              <p className="text-text-secondary">
                {formatBookingWhen(b.requested_start)} · {b.duration_minutes} min
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={pendingId === b.id}
                onClick={() => respond(b.id, declineAction)}
              >
                Decline
              </Button>
              <Button size="sm" disabled={pendingId === b.id} onClick={() => respond(b.id, approveAction)}>
                {pendingId === b.id ? "Working…" : "Approve"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
