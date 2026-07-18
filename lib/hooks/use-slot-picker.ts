"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { tomorrowIso } from "@/lib/scheduling";

export interface SlotPickerResult {
  slots: string[];
  error?: string;
}

/**
 * Shared date+slot state for an availability-driven booking picker (used by
 * both the B4 booking-link flow and C3's per-service public flow — a code
 * review of C3 caught this duplicated inline in both components with a real
 * bug: no guard against out-of-order responses when the date changes twice
 * quickly, which could silently show a confirmation for one date while
 * booking a slot generated for a different one). The request-id ref means a
 * stale fetch that resolves after a newer one started is dropped instead of
 * overwriting fresher slots.
 */
export function useSlotPicker(fetchSlots: (date: string) => Promise<SlotPickerResult>, deps: unknown[] = []) {
  const [date, setDate] = useState(tomorrowIso());
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  function load() {
    const id = ++requestId.current;
    startTransition(async () => {
      setSelectedSlot(null);
      setError(null);
      const result = await fetchSlots(date);
      if (id !== requestId.current) return; // a newer date's fetch started before this one resolved
      if (result.error) setError(result.error);
      setSlots(result.slots);
    });
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchSlots is re-created per render; deps carries its real identity (e.g. token, or [handle, serviceId])
  useEffect(load, [date, ...deps]);

  return { date, setDate, slots, selectedSlot, setSelectedSlot, pending, error, refetch: load };
}
