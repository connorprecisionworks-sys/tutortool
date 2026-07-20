"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";
import clsx from "clsx";
import posthog from "posthog-js";
import { ThemeToggle } from "@/components/theme-toggle";
import { Mark } from "@/components/brand/logo";
import { signOutAction } from "@/app/(auth)/actions";

export interface NavItem {
  href: string;
  label: string;
}

export function AppShell({
  navItems,
  brand,
  userLabel,
  paletteTrigger,
  children,
}: {
  navItems: NavItem[];
  brand: string;
  userLabel?: string;
  // E5 (build-queue.md): the command palette's trigger button/discoverability
  // hint, rendered here in the header so it's visible on every /tutor/*
  // page without this shared shell (also used by /parent) knowing anything
  // about the palette itself — the caller (app/tutor/layout.tsx) owns it.
  paletteTrigger?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function signOut() {
    // Clear the PostHog identity so the next person to log in on this browser
    // (shared/family device) gets a fresh distinct_id instead of inheriting
    // this user's events and session recording. Runs first since
    // signOutAction redirects — nothing after that call executes.
    posthog.reset();
    // Delegates to the shared server action, which signs out and redirects
    // server-side — previously this called supabase.auth.signOut() directly
    // and then did `router.push("/login"); router.refresh()`, which races
    // (see the comment in app/(auth)/actions.ts's signOutAction).
    await signOutAction();
  }

  return (
    <div className="flex min-h-full">
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-surface-sunken transition-transform sm:static sm:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-border px-5">
          <Mark className="h-5" />
          <span className="text-sm font-semibold tracking-tight">{brand}</span>
        </div>
        <nav className="flex-1 space-y-0.5 p-3">
          {navItems.map((item) => {
            // Prefix-matching (so a nested route like /tutor/students/[id]
            // still highlights "Students") must not apply to the shell's
            // own root item (/tutor, /parent) — every other route is a
            // path prefixed by it too, which made "Dashboard"/"Home"
            // permanently show active alongside whichever page you were
            // actually on.
            const hrefSegments = item.href.split("/").filter(Boolean).length;
            const active =
              pathname === item.href || (hrefSegments > 1 && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={clsx(
                  "block rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active ? "bg-hover text-text font-medium" : "text-text-secondary hover:bg-hover hover:text-text"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          {userLabel && <p className="mb-2 truncate px-3 text-xs text-text-tertiary">{userLabel}</p>}
          <button
            onClick={signOut}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-text-secondary hover:bg-hover hover:text-text"
          >
            Sign out
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 sm:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/*
        min-w-0: this is the actual flex item whose width is constrained by
        the row above (`<div className="flex min-h-full">`) — `<aside>` is
        `position:fixed` below `sm:`, so on mobile this is the row's only
        in-flow child, and without min-w-0 its automatic minimum width
        (content's min-content size) can still win over flex-1 when a
        descendant has unbreakable long text, pushing the whole content
        column wider than the viewport instead of letting `<main>` (and any
        `truncate` box inside it) shrink to fit. See the comment on <main>
        below for the QA finding that surfaced this (E3, build-queue.md).
      */}
      <div className="flex min-w-0 min-h-full flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border px-4 sm:px-8">
          <button
            className="flex h-11 w-11 items-center justify-center rounded-lg text-text-secondary hover:bg-hover sm:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
          <div className="hidden sm:block" />
          <div className="flex items-center gap-2">
            {paletteTrigger}
            <ThemeToggle />
          </div>
        </header>
        {/*
          min-w-0 overrides the flex item's default automatic minimum size
          (which, per the flexbox spec, is its content's min-content width
          when overflow is visible) — without it, an unbreakable long string
          anywhere in `children` (a booking link, Student Code, public page
          URL, iCal feed URL — every "truncate" display box this app uses)
          can force this whole <main> wider than the viewport instead of
          letting its own `truncate` utility do its job. Found via E3
          mobile-viewport QA (build-queue.md): a booking link's `<code
          className="flex-1 truncate">` box was overflowing past the screen
          edge at 390px because of exactly this, one level up the tree.
        */}
        <main className="mx-auto min-w-0 w-full max-w-[1100px] flex-1 px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
