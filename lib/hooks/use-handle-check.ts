"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { checkHandleAvailabilityAction, type HandleCheckResult } from "@/app/tutor/settings/profile-actions";
import { normalizeHandle, validateHandleFormat } from "@/lib/handle";

// Derived from the server action's own result type (rather than a
// hand-duplicated union) so a new status value added there can't silently
// fall through the switch below into "idle" — see the `never` check.
// "empty" is excluded: the hook never sends an empty handle over the wire in
// the first place (the `immediate` check below short-circuits to "idle"
// first), so the server action can never actually return it here.
export type HandleCheckStatus = "idle" | "current" | "checking" | Exclude<HandleCheckResult["status"], "empty">;

export interface HandleCheckState {
  status: HandleCheckStatus;
  message: string | null;
}

const DEBOUNCE_MS = 400;

/**
 * Debounced live validation for the handle field (D1), shared by the
 * onboarding wizard and Settings. Format/reserved/empty/unchanged are pure
 * derivations of the input, computed directly during render (no effect,
 * no extra render); only the availability check — which needs a network
 * round-trip via checkHandleAvailabilityAction — goes through an effect,
 * debounced. The request-id guard mirrors use-slot-picker.ts so a stale
 * response from an earlier keystroke can never overwrite a fresher one.
 */
export function useHandleCheck(rawHandle: string, currentHandle?: string | null): HandleCheckState {
  const handle = normalizeHandle(rawHandle);
  const current = currentHandle ? normalizeHandle(currentHandle) : null;

  const immediate = useMemo((): HandleCheckState | null => {
    if (!handle) return { status: "idle", message: null };
    if (handle === current) return { status: "current", message: null };
    const formatError = validateHandleFormat(handle);
    if (formatError) return { status: "invalid", message: formatError };
    return null; // well-formed and changed — needs an availability check
  }, [handle, current]);

  const [checked, setChecked] = useState<{ handle: string; state: HandleCheckState } | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    requestId.current += 1;
    if (immediate) return; // nothing to check over the network

    const id = requestId.current;
    const timer = setTimeout(async () => {
      const result = await checkHandleAvailabilityAction(handle);
      if (id !== requestId.current) return; // a newer keystroke's check started before this one resolved
      switch (result.status) {
        case "available":
          setChecked({ handle, state: { status: "available", message: null } });
          break;
        case "taken":
          setChecked({ handle, state: { status: "taken", message: result.message ?? "That handle is already taken." } });
          break;
        case "invalid":
          setChecked({ handle, state: { status: "invalid", message: result.message ?? "Not a valid handle." } });
          break;
        case "error":
          // Non-blocking on purpose — a transient RPC hiccup shouldn't trap
          // a tutor typing a valid handle behind a disabled submit button.
          // The save action re-validates format/uniqueness regardless.
          setChecked({ handle, state: { status: "error", message: result.message ?? "Couldn't check availability." } });
          break;
        case "empty":
          setChecked({ handle, state: { status: "idle", message: null } });
          break;
        default: {
          // Compile-time guard: a new HandleCheckResult status added to the
          // server action without a case here fails the build instead of
          // silently falling through to "idle" at runtime.
          const _exhaustive: never = result.status;
          void _exhaustive;
        }
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [handle, immediate]);

  if (immediate) return immediate;
  if (checked && checked.handle === handle) return checked.state;
  return { status: "checking", message: null };
}
