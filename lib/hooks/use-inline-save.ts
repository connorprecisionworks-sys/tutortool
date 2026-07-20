"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";

// Long enough to register as "yes, that saved" without lingering — same
// order of magnitude as the label-swap timers CopyStudentCodeButton /
// ShareButton already use elsewhere (1.5s).
const CHECK_FADE_MS = 1500;

/**
 * E4 (build-queue.md) — shared save/pending/error/confirmation plumbing for
 * the list-row inline editors (service price/duration, student name/rate).
 * Reuses the E3 toast hook (`useToast`) for the "saved" confirmation rather
 * than building a second indicator system — callers additionally get a
 * `saved` boolean (auto-clears after CHECK_FADE_MS) for a subtle inline
 * checkmark next to the field itself, since a table full of rapid edits can
 * make a bottom-of-screen toast easy to miss for the specific field that
 * just changed.
 */
export function useInlineSave<Args extends unknown[]>(
  action: (...args: Args) => Promise<{ error?: string }>
) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function save(
    args: Args,
    opts?: { successMessage?: string; onSuccess?: () => void; onError?: () => void }
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action(...args);
      if (result.error) {
        setError(result.error);
        opts?.onError?.();
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), CHECK_FADE_MS);
      if (opts?.successMessage) toast(opts.successMessage, { variant: "success" });
      opts?.onSuccess?.();
    });
  }

  return { save, pending, error, saved, setError };
}
