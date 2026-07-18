"use client";

import { useSyncExternalStore } from "react";

const KEY = "slate-announcement-dismissed";

// Mirrors theme-toggle.tsx's useSyncExternalStore pattern: getServerSnapshot
// keeps SSR/first-paint deterministic (bar shown), then a synced re-render
// picks up the real localStorage value with no hydration warning.
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot(): boolean {
  return localStorage.getItem(KEY) === "1";
}

function getServerSnapshot(): boolean {
  return false;
}

export function AnnouncementBar({ message }: { message: string }) {
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (dismissed) return null;

  function dismiss() {
    localStorage.setItem(KEY, "1");
    // localStorage writes don't fire "storage" in the same tab that made
    // them — dispatch a synthetic one so this component's own subscriber
    // re-checks getSnapshot() and hides the bar immediately.
    window.dispatchEvent(new Event("storage"));
  }

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
