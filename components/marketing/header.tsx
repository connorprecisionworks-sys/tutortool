"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/brand/logo";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
];

export function MarketingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 sm:px-10">
        <Link href="/" aria-label="Slate home" onClick={() => setOpen(false)}>
          <Logo className="h-6 sm:h-7" />
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-text-secondary md:flex">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} className="hover:text-text">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle />
          <Link href="/login" className="text-sm text-text-secondary hover:text-text">
            Log in
          </Link>
          <Link href="/signup/tutor">
            <Button size="sm">Sign up free</Button>
          </Link>
        </div>

        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-hover md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          {open ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          )}
        </button>
      </div>

      {open && (
        <div className="border-t border-border px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-1 text-sm">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-2 text-text-secondary hover:bg-hover hover:text-text"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <ThemeToggle />
            <div className="flex items-center gap-3">
              <Link href="/login" onClick={() => setOpen(false)} className="text-sm text-text-secondary hover:text-text">
                Log in
              </Link>
              <Link href="/signup/tutor" onClick={() => setOpen(false)}>
                <Button size="sm">Sign up free</Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
