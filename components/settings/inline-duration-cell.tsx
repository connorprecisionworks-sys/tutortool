"use client";

import { useEffect, useRef, useState } from "react";
import { updateServiceDurationMinutesAction } from "@/app/tutor/settings/services/actions";
import { useInlineSave } from "@/lib/hooks/use-inline-save";

/**
 * E4 (build-queue.md) — same click-to-edit pattern as InlinePriceCell, for
 * the Duration column. Not required by the literal acceptance line ("rate
 * or a service price") but cheap once the price-cell pattern exists and
 * consistent with "service prices" from the E4 spec text.
 */
export function InlineDurationCell({
  serviceId,
  durationMinutes,
}: {
  serviceId: string;
  durationMinutes: number;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [displayMinutes, setDisplayMinutes] = useState(durationMinutes);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlurRef = useRef(false);
  const { save, pending, error, saved, setError } = useInlineSave(updateServiceDurationMinutesAction);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function startEdit() {
    // Defensive reset — see the matching comment in inline-price-cell.tsx:
    // Escape-cancel can leave skipBlurRef stuck true if no real blur event
    // ever reaches handleBlur, which would otherwise swallow the next
    // legitimate commit on this cell.
    skipBlurRef.current = false;
    setValue(String(displayMinutes));
    setError(null);
    setEditing(true);
  }

  function cancel() {
    skipBlurRef.current = true;
    setEditing(false);
    setError(null);
  }

  function commit() {
    const minutes = Number(value);
    if (value.trim() === "" || Number.isNaN(minutes) || minutes <= 0) {
      setError("Duration must be more than 0 minutes.");
      return;
    }
    const rounded = Math.round(minutes);
    const previous = displayMinutes;
    setDisplayMinutes(rounded);
    setEditing(false);
    save([serviceId, rounded], {
      successMessage: "Duration updated",
      onError: () => setDisplayMinutes(previous),
    });
  }

  function handleBlur() {
    if (skipBlurRef.current) {
      skipBlurRef.current = false;
      return;
    }
    commit();
  }

  if (!editing) {
    return (
      <td className="px-5 py-3 text-text-secondary" data-label="Duration">
        <span className="inline-flex items-center gap-1.5">
          <button
            type="button"
            onClick={startEdit}
            title="Click to edit duration"
            className="-mx-1 rounded px-1 hover:bg-hover focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
          >
            {displayMinutes} min
          </button>
          {saved && (
            <span className="text-xs text-text-tertiary motion-safe:animate-[fade-rise-in_150ms_ease-out]" aria-hidden>
              ✓
            </span>
          )}
        </span>
      </td>
    );
  }

  return (
    <td className="px-5 py-3" data-label="Duration">
      <div className="flex flex-col items-start gap-1">
        <div className="inline-flex items-center gap-1">
          <input
            ref={inputRef}
            type="number"
            step="1"
            min="1"
            inputMode="numeric"
            value={value}
            disabled={pending}
            onChange={(e) => setValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              }
            }}
            className="h-8 w-20 rounded-lg border border-border bg-surface px-2 text-sm tabular-nums text-text focus:outline-none focus:border-border-strong focus:ring-4 focus:ring-[var(--focus-ring)] disabled:opacity-50"
          />
          <span className="text-sm text-text-tertiary">min</span>
        </div>
        {error && <p className="max-w-[10rem] text-xs text-text">{error}</p>}
      </div>
    </td>
  );
}
