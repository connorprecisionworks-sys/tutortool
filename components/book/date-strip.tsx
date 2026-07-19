"use client";

import { useMemo } from "react";
import clsx from "clsx";
import { WEEKDAY_LABELS } from "@/lib/scheduling";

const WEEKDAY_SHORT = WEEKDAY_LABELS.map((d) => d.slice(0, 3));

function isoDateFromToday(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Horizontal scrollable strip of the next `days` dates as tappable pills —
 * replaces a bare native <input type=date> with something visual and
 * mobile-friendly (Cal.com-style day picker), while keeping the same
 * YYYY-MM-DD value the rest of the booking flow already expects.
 */
export function DateStrip({
  value,
  onChange,
  days = 21,
}: {
  value: string;
  onChange: (date: string) => void;
  days?: number;
}) {
  const options = useMemo(
    () =>
      Array.from({ length: days }, (_, i) => {
        const iso = isoDateFromToday(i);
        const d = new Date(`${iso}T00:00:00Z`);
        return { iso, weekday: WEEKDAY_SHORT[d.getUTCDay()], day: d.getUTCDate() };
      }),
    [days]
  );

  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label="Pick a date">
      {options.map((opt) => {
        const selected = opt.iso === value;
        return (
          <button
            key={opt.iso}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.iso)}
            className={clsx(
              "flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-3 py-2 text-center transition motion-safe:hover:-translate-y-0.5",
              selected ? "border-accent bg-accent text-accent-text" : "border-border bg-surface text-text hover:bg-hover"
            )}
            style={{ minWidth: "3.25rem" }}
          >
            <span
              className={clsx(
                "text-[10px] font-medium uppercase tracking-wide",
                selected ? "text-accent-text/80" : "text-text-tertiary"
              )}
            >
              {opt.weekday}
            </span>
            <span className="text-base font-semibold">{opt.day}</span>
          </button>
        );
      })}
    </div>
  );
}
