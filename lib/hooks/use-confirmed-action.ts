"use client";

import { useState, useTransition } from "react";

/**
 * Shared confirm -> call server action -> surface error-or-run-onSuccess
 * pattern used by every destructive/state-changing button across the
 * tutor dashboard (delete session, delete student, delete invoice, cancel
 * booking, revoke/regenerate invite, ...). Each of those independently
 * reimplemented pending/error state plus the same three-line
 * confirm+startTransition wrapper — this collapses them to one call site.
 */
export function useConfirmedAction<Args extends unknown[]>(
  action: (...args: Args) => Promise<{ error?: string }>,
  confirmMessage: string,
  onSuccess?: () => void
) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(...args: Args) {
    if (!confirm(confirmMessage)) return;
    setError(null);
    startTransition(async () => {
      const result = await action(...args);
      if (result.error) {
        setError(result.error);
        return;
      }
      onSuccess?.();
    });
  }

  return { run, pending, error };
}
