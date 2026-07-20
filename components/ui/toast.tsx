"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";

type ToastVariant = "default" | "success";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastOptions {
  variant?: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, opts?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Long enough to read a short confirmation, short enough to not linger —
// matches the design system's "minimal, bottom-center" toast spec (no
// dismiss button; time-based dismissal keeps this one primitive simple).
const DISMISS_MS = 2800;

/**
 * App-wide toast primitive (E3 — see build-queue.md). Mounted once near the
 * root so any client component under it can call useToast() — including
 * across a client-side router.push(), since the provider lives above the
 * route segment that's changing and never unmounts.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, opts?: ToastOptions) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, message, variant: opts?.variant ?? "default" }]);
      setTimeout(() => dismiss(id), DISMISS_MS);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        role="status"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6"
      >
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            className={clsx(
              "pointer-events-auto flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-left text-sm text-text",
              "motion-safe:animate-[fade-rise-in_200ms_ease-out]"
            )}
          >
            {t.variant === "success" && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-text" />}
            {/* min-w-0 overrides the flex item's default min-width: auto —
                without it, `truncate` (overflow-hidden + nowrap) can't
                actually shrink the text below its intrinsic width inside a
                flex row, so long messages overflow the button instead of
                ellipsizing. */}
            <span className="min-w-0 truncate">{t.message}</span>
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
