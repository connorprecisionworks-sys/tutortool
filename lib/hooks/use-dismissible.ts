"use client";

import { useSyncExternalStore } from "react";

// Mirrors theme-toggle.tsx's useSyncExternalStore pattern: getServerSnapshot
// keeps SSR/first-paint deterministic (never dismissed), then a synced
// re-render picks up the real localStorage value with no hydration warning.
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Shared dismiss-state hook for one-time/persistent UI dismissals (intro
 * cards, checklists, announcement bars) — localStorage-backed, per-key so
 * one component instance can serve many tutors/keys, cross-tab-synced.
 * Consolidates what were three independent copies of this exact pattern
 * (AnnouncementBar, OnboardingChecklist, HowSlateWorksCard) into one.
 *
 * No module-level cache: the snapshot getter re-reads localStorage on every
 * call. An earlier version cached the first read per key, which broke
 * genuine cross-tab sync — a real "storage" event from another tab firing
 * would invoke this getter, but a cache hit meant it returned the stale
 * value instead of the freshly-changed one. localStorage.getItem is a fast
 * synchronous call and getSnapshot returning a primitive (not a new
 * object/array each call) is exactly what useSyncExternalStore expects, so
 * there's no correctness reason to cache it.
 */
export function useDismissible(key: string): { dismissed: boolean; dismiss: () => void } {
  const dismissed = useSyncExternalStore(subscribe, () => localStorage.getItem(key) === "1", getServerSnapshot);

  function dismiss() {
    localStorage.setItem(key, "1");
    // localStorage writes don't fire "storage" in the same tab that made
    // them — dispatch a synthetic one so this hook's own subscriber (and
    // any other mounted instance) re-checks and updates immediately.
    window.dispatchEvent(new Event("storage"));
  }

  return { dismissed, dismiss };
}
