"use client";

import { groupSlotsByPeriod, formatIsoSlotTime as formatTime } from "@/lib/scheduling";

/**
 * Open slots for a single day, grouped into Morning/Afternoon/Evening
 * sections instead of one flat grid — scans faster once a tutor has more
 * than a handful of open times in a day. Shared by every availability-
 * driven picker (service booking + open-availability booking link).
 */
export function TimeSlotGrid({ slots, onSelect }: { slots: string[]; onSelect: (slot: string) => void }) {
  const groups = groupSlotsByPeriod(slots);

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-tertiary">{group.label}</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {group.slots.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSelect(s)}
                className="rounded-lg border border-border bg-surface px-3 py-2.5 text-center text-sm font-medium transition motion-safe:hover:-translate-y-0.5 hover:border-accent hover:bg-hover"
              >
                {formatTime(s)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
