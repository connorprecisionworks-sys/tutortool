"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Card } from "@/components/ui/card";

// Same client-only dismiss pattern as OnboardingChecklist (D2): a tiny
// external store instead of useEffect+setState so server and first-client
// render agree (getServerSnapshot always "not dismissed"), then React
// reconciles the real localStorage value right after hydration.
const dismissCache = new Map<string, boolean>();
const listeners = new Set<() => void>();

function dismissKey(tutorId: string) {
  return `slate:how-it-works-dismissed:${tutorId}`;
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(tutorId: string) {
  if (!dismissCache.has(tutorId)) {
    dismissCache.set(tutorId, localStorage.getItem(dismissKey(tutorId)) === "1");
  }
  return dismissCache.get(tutorId)!;
}

function getServerSnapshot() {
  return false;
}

function dismiss(tutorId: string) {
  localStorage.setItem(dismissKey(tutorId), "1");
  dismissCache.set(tutorId, true);
  listeners.forEach((callback) => callback());
}

const STEPS = [
  { label: "Add a student", description: "Their rate, contact, and a Student Code for their parent.", href: "/tutor/students/new" },
  { label: "Set your availability", description: "The hours parents can book you, by day of week.", href: "/tutor/schedule" },
  { label: "Send a booking link", description: "Share a link — no back-and-forth, they pick a time.", href: "/tutor/booking-links/new" },
  { label: "Invoice for sessions", description: "Bundle logged sessions and send a Stripe payment link.", href: "/tutor/invoices/new" },
];

/**
 * A standing "how this app works" orientation (D2), distinct from
 * OnboardingChecklist's one-time required-setup tracker below it — this
 * explains the ongoing day-to-day loop and stays useful (and dismissible)
 * well after setup is done, for a tutor who's set up but still unsure what
 * to actually do each week.
 */
export function HowSlateWorksCard({ tutorId, className }: { tutorId: string; className?: string }) {
  const dismissed = useSyncExternalStore(subscribe, () => getSnapshot(tutorId), getServerSnapshot);
  if (dismissed) return null;

  return (
    <Card className={clsx("relative", className)}>
      <button
        type="button"
        onClick={() => dismiss(tutorId)}
        aria-label="Dismiss how Slate works card"
        className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-lg text-text-tertiary hover:bg-hover hover:text-text"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>

      <h2 className="pr-8 text-sm font-semibold">Learn how to use Slate</h2>
      <p className="mt-1 text-sm text-text-secondary">
        The everyday loop: add students, keep your availability current, send booking links, and invoice for
        what you&apos;ve taught.
      </p>

      <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <li key={step.href}>
            <Link
              href={step.href}
              className="block h-full rounded-lg border border-border p-3 transition-colors hover:border-border-strong hover:bg-hover"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border-strong text-xs font-medium text-text-secondary">
                {i + 1}
              </span>
              <p className="mt-2.5 text-sm font-medium">{step.label}</p>
              <p className="mt-1 text-xs text-text-tertiary">{step.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
