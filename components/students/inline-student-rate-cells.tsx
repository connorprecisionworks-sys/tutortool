"use client";

import { useEffect, useRef, useState, type FocusEvent } from "react";
import { updateStudentRateAction } from "@/app/tutor/students/actions";
import { useInlineSave } from "@/lib/hooks/use-inline-save";
import { formatCents, dollarsToCents } from "@/lib/money";
import {
  RATE_TYPE_LABELS,
  RATE_TYPES_REQUIRING_CUSTOM_RATE,
  resolveEffectiveRateCents,
  type RateType,
} from "@/lib/billing";

const RATE_TYPE_OPTIONS = Object.entries(RATE_TYPE_LABELS) as [RateType, string][];

/**
 * E4 (build-queue.md) — inline Rate + Effective rate editor on the Students
 * list. Renders both <td>s together (as siblings inside the row) because
 * the Effective rate column has to update optimistically the instant the
 * rate type/custom rate changes — it mirrors resolveEffectiveRateCents from
 * lib/billing.ts exactly, the same resolution rule session-form.tsx's
 * preview calc and the server already use, so this can never show a number
 * that diverges from what a session logged right now would actually bill.
 *
 * Interaction: click "Rate" -> a <select> of the 5 rate types appears.
 * Picking standard/pro_bono needs nothing else, so it saves immediately and
 * collapses back to display mode. Picking professional_discount/friend/
 * low_income (all resolved via custom_rate_cents) reveals an inline $ input
 * next to the select — carrying over any custom rate already on file if
 * switching between two of those three types — and saves on Enter/blur.
 * Matches updateStudentRateAction's server-side requirement that those
 * three types must have a non-null custom rate (same as the full
 * StudentForm) rather than silently accepting a blank value.
 */
export function StudentRateCells({
  studentId,
  initialRateType,
  initialCustomRateCents,
  standardRateCents,
}: {
  studentId: string;
  initialRateType: RateType;
  initialCustomRateCents: number | null;
  standardRateCents: number;
}) {
  const [editing, setEditing] = useState(false);

  // Last known-persisted values — drive the display (when not editing) and
  // the optimistic Effective rate. Reverted to the pre-edit value on a
  // failed save so the two columns can never diverge from what's actually
  // in the DB for longer than a single failed round trip.
  const [savedRateType, setSavedRateType] = useState<RateType>(initialRateType);
  const [savedCustomRateCents, setSavedCustomRateCents] = useState<number | null>(initialCustomRateCents);

  // Draft state while the row is open for editing.
  const [draftRateType, setDraftRateType] = useState<RateType>(initialRateType);
  const [draftCustomInput, setDraftCustomInput] = useState(
    initialCustomRateCents != null ? (initialCustomRateCents / 100).toFixed(2) : ""
  );

  const groupRef = useRef<HTMLDivElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);
  const skipBlurRef = useRef(false);
  const { save, pending, error, saved, setError } = useInlineSave(updateStudentRateAction);

  const draftNeedsCustomRate = RATE_TYPES_REQUIRING_CUSTOM_RATE.includes(draftRateType);

  useEffect(() => {
    if (editing && draftNeedsCustomRate) {
      customInputRef.current?.focus();
      customInputRef.current?.select();
    }
  }, [editing, draftNeedsCustomRate]);

  function startEdit() {
    // Defensive reset — see the matching comment in inline-price-cell.tsx:
    // Escape-cancel can leave skipBlurRef stuck true if no real blur event
    // ever reaches handleGroupBlur, which would otherwise swallow the next
    // legitimate commit on this cell.
    skipBlurRef.current = false;
    setError(null);
    setDraftRateType(savedRateType);
    setDraftCustomInput(savedCustomRateCents != null ? (savedCustomRateCents / 100).toFixed(2) : "");
    setEditing(true);
  }

  function cancel() {
    skipBlurRef.current = true;
    setEditing(false);
    setError(null);
  }

  function persist(nextRateType: RateType, nextCustomRateCents: number | null) {
    const previousRateType = savedRateType;
    const previousCustomRateCents = savedCustomRateCents;
    setSavedRateType(nextRateType);
    setSavedCustomRateCents(nextCustomRateCents);
    save([studentId, nextRateType, nextCustomRateCents], {
      successMessage: "Rate updated",
      onError: () => {
        setSavedRateType(previousRateType);
        setSavedCustomRateCents(previousCustomRateCents);
      },
    });
  }

  function handleRateTypeChange(value: RateType) {
    setDraftRateType(value);
    setError(null);
    if (!RATE_TYPES_REQUIRING_CUSTOM_RATE.includes(value)) {
      // standard / pro_bono need nothing else typed — save immediately and
      // collapse, matching the "a click, no typing" fast path.
      setEditing(false);
      persist(value, null);
      return;
    }
    // The other three all resolve through custom_rate_cents — carry over
    // whatever's already on file (switching e.g. friend -> low_income
    // shouldn't blank a rate the tutor already set) and keep editing open
    // so they can confirm/change it.
    setDraftCustomInput(savedCustomRateCents != null ? (savedCustomRateCents / 100).toFixed(2) : "");
  }

  function commitCustomRate() {
    const trimmed = draftCustomInput.trim();
    const dollars = Number(trimmed);
    if (!trimmed || Number.isNaN(dollars) || dollars < 0) {
      setError("This rate type needs an hourly rate.");
      return;
    }
    setEditing(false);
    persist(draftRateType, dollarsToCents(dollars));
  }

  function handleGroupBlur(e: FocusEvent<HTMLDivElement>) {
    if (skipBlurRef.current) {
      skipBlurRef.current = false;
      return;
    }
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return; // focus moved within the group (select -> $ input)
    if (draftNeedsCustomRate) {
      commitCustomRate();
    } else {
      setEditing(false);
    }
  }

  const effectiveCents = resolveEffectiveRateCents(savedRateType, savedCustomRateCents, standardRateCents);

  if (!editing) {
    return (
      <>
        <td className="px-5 py-3 text-text-secondary" data-label="Rate">
          <span className="inline-flex items-center gap-1.5">
            <button
              type="button"
              onClick={startEdit}
              title="Click to edit rate"
              className="-mx-1 rounded px-1 hover:bg-hover focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
            >
              {RATE_TYPE_LABELS[savedRateType]}
            </button>
            {saved && (
              <span className="text-xs text-text-tertiary motion-safe:animate-[fade-rise-in_150ms_ease-out]" aria-hidden>
                ✓
              </span>
            )}
          </span>
        </td>
        <td className="px-5 py-3 text-right tabular-nums" data-label="Effective rate">
          {formatCents(effectiveCents)}/hr
        </td>
      </>
    );
  }

  return (
    <>
      <td className="px-5 py-3" data-label="Rate">
        <div ref={groupRef} onBlur={handleGroupBlur} className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <select
              autoFocus
              value={draftRateType}
              disabled={pending}
              onChange={(e) => handleRateTypeChange(e.target.value as RateType)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancel();
                }
              }}
              className="h-8 rounded-lg border border-border bg-surface px-2 pr-6 text-sm text-text focus:outline-none focus:border-border-strong focus:ring-4 focus:ring-[var(--focus-ring)] disabled:opacity-50"
            >
              {RATE_TYPE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {draftNeedsCustomRate && (
              <span className="inline-flex items-center gap-1">
                <span className="text-sm text-text-tertiary">$</span>
                <input
                  ref={customInputRef}
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  placeholder="/hr"
                  value={draftCustomInput}
                  disabled={pending}
                  onChange={(e) => {
                    setDraftCustomInput(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitCustomRate();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      cancel();
                    }
                  }}
                  className="h-8 w-20 rounded-lg border border-border bg-surface px-2 text-sm tabular-nums text-text focus:outline-none focus:border-border-strong focus:ring-4 focus:ring-[var(--focus-ring)] disabled:opacity-50"
                />
              </span>
            )}
          </div>
          {error && <p className="max-w-[10rem] text-xs text-text">{error}</p>}
        </div>
      </td>
      <td className="px-5 py-3 text-right tabular-nums text-text-secondary" data-label="Effective rate">
        {formatCents(effectiveCents)}/hr
      </td>
    </>
  );
}
