"use client";

import { useSyncExternalStore } from "react";

const cache = new Map<string, boolean>();

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
 */
export function useDismissible(key: string): { dismissed: boolean; dismiss: () => void } {
  const dismissed = useSyncExternalStore(
    subscribe,
    () => {
      if (!cache.has(key)) cache.set(key, localStorage.getItem(key) === "1");
      return cache.get(key)!;
    },
    getServerSnapshot
  );

  function dismiss() {
    localStorage.setItem(key, "1");
    cache.set(key, true);
    // localStorage writes don't fire "storage" in the same tab that made
    // them — dispatch a synthetic one so this hook's own subscriber (and
    // any other mounted instance) re-checks and updates immediately.
    window.dispatchEvent(new Event("storage"));
  }

  return { dismissed, dismiss };
}
