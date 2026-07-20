"use client";

import { useEffect, useRef, useState } from "react";
import { updateServicePriceAction } from "@/app/tutor/settings/services/actions";
import { formatCents, dollarsToCents } from "@/lib/money";
import { useInlineSave } from "@/lib/hooks/use-inline-save";

/**
 * E4 (build-queue.md) — click-to-edit Price cell on the Services list.
 * Click the price -> focused $ input -> Enter/blur saves via
 * updateServicePriceAction, Escape cancels and reverts. Acceptance line:
 * "changing a ... service price takes a click, a type, and no page
 * navigation" — this replaces the old flow of navigating to
 * /tutor/settings/services/[id] just to change one column.
 */
export function InlinePriceCell({ serviceId, priceCents }: { serviceId: string; priceCents: number }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  // Optimistic display value — only ever diverges from `priceCents` between
  // a successful save and the next server-data refresh, and reverts itself
  // on error so a failed save can never leave a stale/wrong price on screen.
  const [displayCents, setDisplayCents] = useState(priceCents);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlurRef = useRef(false);
  const { save, pending, error, saved, setError } = useInlineSave(updateServicePriceAction);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function startEdit() {
    // Defensive reset: if the previous edit session ended via Escape with no
    // matching blur event actually reaching handleBlur (React doesn't
    // redeliver a synthetic blur to an already-unmounted fiber, so a
    // cancel() that sets this flag can otherwise get "stuck" true forever),
    // a stale `true` here would silently swallow the very next real commit.
    skipBlurRef.current = false;
    setValue((displayCents / 100).toFixed(2));
    setError(null);
    setEditing(true);
  }

  function cancel() {
    skipBlurRef.current = true;
    setEditing(false);
    setError(null);
  }

  function commit() {
    const dollars = Number(value);
    if (value.trim() === "" || Number.isNaN(dollars) || dollars < 0) {
      setError("Price must be a positive number.");
      return;
    }
    const cents = dollarsToCents(dollars);
    const previous = displayCents;
    setDisplayCents(cents);
    setEditing(false);
    save([serviceId, cents], {
      successMessage: "Price updated",
      onError: () => setDisplayCents(previous),
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
      <td className="px-5 py-3 text-right tabular-nums" data-label="Price">
        <span className="inline-flex items-center gap-1.5">
          <button
            type="button"
            onClick={startEdit}
            title="Click to edit price"
            className="-mx-1 rounded px-1 hover:bg-hover focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
          >
            {formatCents(displayCents)}
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
    <td className="px-5 py-3 text-right" data-label="Price">
      <div className="flex flex-col items-end gap-1">
        <div className="inline-flex items-center gap-1">
          <span className="text-sm text-text-tertiary">$</span>
          <input
            ref={inputRef}
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
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
            className="h-8 w-24 rounded-lg border border-border bg-surface px-2 text-right text-sm tabular-nums text-text focus:outline-none focus:border-border-strong focus:ring-4 focus:ring-[var(--focus-ring)] disabled:opacity-50"
          />
        </div>
        {error && <p className="max-w-[10rem] text-right text-xs text-text">{error}</p>}
      </div>
    </td>
  );
}
