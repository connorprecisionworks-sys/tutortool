"use client";

import { useDismissible } from "@/lib/hooks/use-dismissible";

const KEY = "slate-announcement-dismissed";

export function AnnouncementBar({ message }: { message: string }) {
  const { dismissed, dismiss } = useDismissible(KEY);

  if (dismissed) return null;

  return (
    <div className="flex items-center justify-center gap-3 bg-accent/10 px-4 py-2 text-center text-xs text-text sm:text-sm">
      <p>{message}</p>
      <button
        onClick={dismiss}
        aria-label="Dismiss announcement"
        className="flex h-11 w-11 shrink-0 items-center justify-center text-text-secondary hover:text-text sm:h-auto sm:w-auto"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
