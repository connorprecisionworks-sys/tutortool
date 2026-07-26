"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

const LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
];

/**
 * Landing chrome — fixed dark glass over the cinematic page (the landing is
 * near-black in both themes, so no theme toggle and the on-dark logo asset
 * is used directly). The only CTA is the waitlist; "Log in" stays as a quiet
 * link for existing early-access users.
 */
export function MarketingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[rgba(168,184,204,0.1)] bg-[rgba(18,18,20,0.72)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 sm:px-10">
        <Link href="/" aria-label="Slate home" onClick={() => setOpen(false)}>
          <Image
            src="/brand/logo/slate-logo-on-dark.svg"
            alt="Slate"
            width={886}
            height={236}
            className="h-6 w-auto sm:h-7"
          />
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-[#a8b8cc] md:flex">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} className="transition duration-150 hover:text-[#f7f7f7]">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <Link href="/login" className="text-sm text-[#a8b8cc] transition duration-150 hover:text-[#f7f7f7]">
            Log in
          </Link>
          <a
            href="#waitlist"
            className="inline-flex h-9 items-center rounded-lg bg-[#5f728c] px-4 text-sm font-medium text-white shadow-[0_0_24px_-6px_rgba(95,114,140,0.8)] transition duration-150 hover:opacity-90 motion-safe:hover:-translate-y-0.5"
          >
            Join the waitlist
          </a>
        </div>

        <button
          className="flex h-11 w-11 items-center justify-center rounded-lg text-[#a8b8cc] transition duration-150 hover:bg-[rgba(168,184,204,0.08)] hover:text-[#f7f7f7] md:hidden"
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
        <div className="border-t border-[rgba(168,184,204,0.1)] px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-1 text-sm">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-2 text-[#a8b8cc] transition duration-150 hover:bg-[rgba(168,184,204,0.08)] hover:text-[#f7f7f7]"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mt-3 flex items-center justify-between border-t border-[rgba(168,184,204,0.1)] pt-4">
            <Link href="/login" onClick={() => setOpen(false)} className="text-sm text-[#a8b8cc] hover:text-[#f7f7f7]">
              Log in
            </Link>
            <a
              href="#waitlist"
              onClick={() => setOpen(false)}
              className="inline-flex h-9 items-center rounded-lg bg-[#5f728c] px-4 text-sm font-medium text-white"
            >
              Join the waitlist
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
