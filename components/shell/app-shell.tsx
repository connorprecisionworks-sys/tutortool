"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useState } from "react";
import clsx from "clsx";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";

export interface NavItem {
  href: string;
  label: string;
}

export function AppShell({
  navItems,
  brand,
  userLabel,
  children,
}: {
  navItems: NavItem[];
  brand: string;
  userLabel?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-full">
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-surface-sunken transition-transform sm:static sm:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center border-b border-border px-5">
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
                  "block rounded-lg px-3 py-2 text-sm transition-colors",
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

      <div className="flex min-h-full flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border px-4 sm:px-8">
          <button
            className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-hover sm:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
          <div className="hidden sm:block" />
          <ThemeToggle />
        </header>
        <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
