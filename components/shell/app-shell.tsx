"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import clsx from "clsx";
import posthog from "posthog-js";
import { ThemeToggle } from "@/components/theme-toggle";
import { Mark } from "@/components/brand/logo";
import { signOutAction } from "@/app/(auth)/actions";
import { recordFeedbackBreadcrumb } from "@/lib/feedback/breadcrumbs";
import { NavIcon } from "@/components/shell/nav-icons";
import { resolveNav, type NavItem, type NavSection } from "@/lib/nav";

// Re-exported for the call sites that imported the type from here before the
// nav types moved into lib/nav.ts (which is where the data lives, and which
// app-shell now imports from — the type had to move to break the cycle).
export type { NavItem, NavSection };

const COLLAPSE_KEY = "slate_nav_collapsed";

// Same shape as components/theme-toggle.tsx, and for the same reason: the
// inline script in app/layout.tsx writes data-nav on <html> before first
// paint, so the DOM attribute — not React state — is the source of truth for
// this browser-only preference. useSyncExternalStore reads it without a
// hydration mismatch, without a useEffect+setState cascade, and without the
// sidebar visibly snapping from wide to narrow after load.
function subscribeCollapsed(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-nav"] });
  return () => observer.disconnect();
}

function getCollapsed(): boolean {
  return document.documentElement.getAttribute("data-nav") === "collapsed";
}

function getServerCollapsed(): boolean {
  return false;
}

function applyCollapsed(collapsed: boolean) {
  document.documentElement.setAttribute("data-nav", collapsed ? "collapsed" : "expanded");
  try {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  } catch {
    // Private-mode / storage-disabled: the toggle still works for this
    // page view, it just won't be remembered. Not worth surfacing.
  }
}

export function AppShell({
  navItems,
  brand,
  userLabel,
  paletteTrigger,
  feedbackTrigger,
  children,
}: {
  navItems: NavSection[];
  brand: string;
  userLabel?: string;
  // E5 (build-queue.md): the command palette's trigger button/discoverability
  // hint, rendered here in the header so it's visible on every /tutor/*
  // page without this shared shell (also used by /parent) knowing anything
  // about the palette itself — the caller (app/tutor/layout.tsx) owns it.
  paletteTrigger?: ReactNode;
  // F1 (build-queue.md): the feedback widget's trigger, same ownership
  // pattern as paletteTrigger — only the tutor layout passes one, so the
  // parent portal never renders a Feedback entry point.
  feedbackTrigger?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const collapsed = useSyncExternalStore(subscribeCollapsed, getCollapsed, getServerCollapsed);

  const { section: activeSection, page: activePage } = resolveNav(pathname, navItems);
  const subPages = activeSection?.children ?? [];
  const showSubNav = subPages.length > 1;

  const subNavRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  // Which section the pill was last positioned for. The slide is only
  // meaningful *within* a tab row — when you jump sections the row's
  // contents change underneath it, so the pill snaps rather than gliding
  // across a set of tabs that no longer exists.
  const pillSectionRef = useRef<string | undefined>(undefined);

  // Writes the pill's box directly to the DOM rather than holding it in
  // state: the value is a measurement of the rendered layout, so putting it
  // through React would mean render -> measure -> setState -> render again
  // on every navigation (and trip the set-state-in-effect rule for good
  // reason). useEffect, not useLayoutEffect — the pill starts at opacity 0,
  // so there's nothing to see before the first positioning pass, and this
  // avoids the SSR useLayoutEffect warning.
  useEffect(() => {
    const container = subNavRef.current;
    const pill = pillRef.current;
    if (!container || !pill) return;

    function position(animate: boolean) {
      if (!container || !pill) return;
      const tab = container.querySelector<HTMLElement>('[data-active="true"]');
      if (!tab) {
        pill.style.opacity = "0";
        return;
      }
      if (!animate) pill.style.transition = "none";
      pill.style.width = `${tab.offsetWidth}px`;
      pill.style.transform = `translateX(${tab.offsetLeft}px)`;
      pill.style.opacity = "1";
      if (!animate) {
        // Flush the jump before restoring the stylesheet's transition, so
        // the snap doesn't get animated retroactively.
        void pill.offsetWidth;
        pill.style.transition = "";
      }
    }

    position(pillSectionRef.current === activeSection?.href);
    pillSectionRef.current = activeSection?.href;

    // Tab widths change with the viewport (and with font loading), and a
    // resize is never a state change worth animating.
    const onResize = () => position(false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pathname, showSubNav, activeSection?.href]);

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
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-surface-sunken transition-[transform,width] duration-200 sm:static sm:translate-x-0",
          collapsed ? "w-64 sm:w-[68px]" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div
          className={clsx(
            // No flex gap here (or on the nav items below) — .nav-label owns
            // the icon-to-label spacing as a margin so it can animate to
            // zero on collapse. See the .nav-label block in globals.css.
            "flex h-14 shrink-0 items-center border-b border-border",
            collapsed ? "px-5 sm:justify-center sm:px-0" : "px-5"
          )}
        >
          <Mark className="h-5 shrink-0" />
          <span className="nav-label text-sm font-semibold tracking-tight">{brand}</span>
        </div>

        <nav className={clsx("flex-1 space-y-1 py-3", collapsed ? "px-3 sm:px-2.5" : "px-3")}>
          {navItems.map((item) => {
            // A section is current when the current URL resolved to one of
            // its pages — see resolveNav in lib/nav.ts for why that's a
            // longest-match rather than a plain prefix test.
            const active = activeSection?.href === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                onClick={() => {
                  // F1 (build-queue.md): nav labels are static strings from
                  // lib/nav.ts — safe to record verbatim, never row/user data.
                  recordFeedbackBreadcrumb("click", item.label);
                  setMobileOpen(false);
                }}
                data-active={active}
                className={clsx(
                  "nav-item flex items-center rounded-lg py-2.5 text-sm transition-colors",
                  collapsed ? "px-3 sm:h-10 sm:justify-center sm:px-0 sm:py-0" : "px-3",
                  active
                    ? "bg-hover text-text font-medium"
                    : "text-text-secondary hover:bg-hover hover:text-text"
                )}
              >
                <NavIcon name={item.icon} className="shrink-0" />
                <span className="nav-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={clsx("border-t border-border py-3", collapsed ? "px-3 sm:px-2.5" : "px-3")}>
          {userLabel && (
            <p className={clsx("mb-2 truncate px-3 text-xs text-text-tertiary", collapsed && "sm:hidden")}>
              {userLabel}
            </p>
          )}
          <div className={collapsed ? "sm:hidden" : undefined}>{feedbackTrigger}</div>
          <button
            onClick={signOut}
            title={collapsed ? "Sign out" : undefined}
            className={clsx(
              "nav-item flex w-full items-center rounded-lg py-2 text-left text-sm text-text-secondary hover:bg-hover hover:text-text",
              collapsed ? "px-3 sm:h-10 sm:justify-center sm:px-0 sm:py-0" : "px-3"
            )}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0"
              aria-hidden
            >
              <path d="M15 17.5v1.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 15 5v1.5M10.5 12h9.5M17.5 9l3 3-3 3" />
            </svg>
            <span className="nav-label">Sign out</span>
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
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <button
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-hover sm:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle navigation"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>
            <button
              className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-hover hover:text-text sm:flex"
              onClick={() => applyCollapsed(!collapsed)}
              aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
              aria-pressed={collapsed}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
                <path d="M10 4.5v15" />
              </svg>
            </button>
            {/* Where you are, in one word — the sidebar no longer has to be
                open (or expanded) for the current section to be legible. */}
            {activeSection && (
              <span className="truncate text-sm font-medium">{activeSection.label}</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {paletteTrigger}
            <ThemeToggle />
          </div>
        </header>

        {/* Sub-tabs: the pages that used to each own a sidebar line. Only
            rendered for sections that actually have more than one page, so
            single-page sections (the whole parent portal) get no empty bar. */}
        {showSubNav && (
          <div className="border-b border-border px-4 sm:px-8">
            <div
              ref={subNavRef}
              className="relative mx-auto flex w-full max-w-[1100px] gap-1 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {/* The travelling highlight. Sits behind the labels; its box is
                  set from the active tab by the effect above. Tabs carry no
                  background of their own, so there's only ever one of these
                  on screen to follow. */}
              <span ref={pillRef} className="subtab-pill" aria-hidden />
              {subPages.map((page) => {
                const active = activePage?.href === page.href;
                return (
                  <Link
                    key={page.href}
                    href={page.href}
                    onClick={() => recordFeedbackBreadcrumb("click", page.label)}
                    aria-current={active ? "page" : undefined}
                    data-active={active}
                    className={clsx(
                      "relative z-10 shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors",
                      active ? "text-text font-medium" : "text-text-secondary hover:text-text"
                    )}
                  >
                    {page.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

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
        <main className="mx-auto min-w-0 w-full max-w-[1100px] flex-1 px-4 py-8 sm:px-8">
          {/* Keyed on the path so the enter animation replays on every
              navigation. Next already swaps `children` on a route change;
              the key is what makes React treat it as a fresh mount instead
              of a re-render, which is what restarts the CSS animation. */}
          <div key={pathname} className="page-enter">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
