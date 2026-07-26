"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The hero's floating product scene — Linear/Resend-school: the product
 * itself, tilted in space as layered glass cards, with live moments looping
 * calmly. The loops are synchronized into one story beat every 9s: the
 * payment toast arrives → the week's revenue ticks up with a pop → the
 * invoice pill resolves to Paid. A narrow light arc orbits the main card's
 * border the whole time, and pointer movement tilts the stack (fine
 * pointers only).
 *
 * Fixed dark styling — the hero band is cinematic near-black in both themes.
 * Reduced-motion visitors get the fully-resolved static scene: toast shown,
 * invoice Paid, revenue at its settled value, sparkline drawn, no orbit.
 */

const BASE_REVENUE = "$1,240";
const BUMPED_REVENUE = "$1,480";

export function HeroScene() {
  const tiltRef = useRef<HTMLDivElement>(null);
  // null = reduced-motion/static (settled value), false/true = live loop
  const [bumped, setBumped] = useState<boolean | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Starts at the settled value while the entrance plays, then joins the
    // 9s story beat: toast lands ~3.6s into its cycle (3s delay + 7% of 9s),
    // the revenue pop follows half a beat later, and it resets when the
    // toast leaves. All setState calls happen inside timer callbacks, never
    // synchronously in the effect body.
    const timers: ReturnType<typeof setTimeout>[] = [];
    const cycle = () => {
      timers.push(setTimeout(() => setBumped(true), 4200));
      timers.push(setTimeout(() => setBumped(false), 8600));
    };
    cycle();
    const iv = setInterval(cycle, 9000);
    return () => {
      clearInterval(iv);
      timers.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    const el = tiltRef.current;
    if (!el) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Track the pointer across the whole hero section, not just the card
    // stack — the tilt should respond while reading the headline too.
    const zone = el.closest("section") ?? el;

    const onMove = (e: PointerEvent) => {
      const r = zone.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty("--tilt-x", `${(-y * 5).toFixed(2)}deg`);
      el.style.setProperty("--tilt-y", `${(x * 7).toFixed(2)}deg`);
    };
    const onLeave = () => {
      el.style.setProperty("--tilt-x", "0deg");
      el.style.setProperty("--tilt-y", "0deg");
    };

    zone.addEventListener("pointermove", onMove as EventListener);
    zone.addEventListener("pointerleave", onLeave);
    return () => {
      zone.removeEventListener("pointermove", onMove as EventListener);
      zone.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  const revenue = bumped === null ? BUMPED_REVENUE : bumped ? BUMPED_REVENUE : BASE_REVENUE;

  const glass =
    "rounded-2xl border border-[rgba(168,184,204,0.14)] bg-[rgba(30,32,38,0.6)] backdrop-blur-xl";

  return (
    <div className="relative mx-auto w-full max-w-xl" style={{ perspective: "1400px" }}>
      <div
        ref={tiltRef}
        className="relative transition-transform duration-300 ease-out"
        style={{
          transform: "rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))",
          transformStyle: "preserve-3d",
        }}
      >
        {/* Main dashboard card, ringed by an orbiting light arc */}
        <div className="relative z-10 mr-10 motion-safe:animate-[card-enter_0.8s_ease-out_0.55s_both,scene-float_7s_ease-in-out_1.6s_infinite]">
          <div className="relative overflow-hidden rounded-2xl p-px shadow-[0_40px_100px_-24px_rgba(0,0,0,0.8),0_0_90px_-18px_rgba(95,114,140,0.45)]">
            {/* the orbiting arc: an oversized spinning conic gradient showing
                through the 1px padding ring */}
            <span
              aria-hidden
              className="absolute inset-[-150%] motion-safe:animate-[border-spin_7s_linear_infinite]"
              style={{
                background:
                  "conic-gradient(from 0deg, transparent 0deg 300deg, rgba(168,184,204,0.9) 330deg, rgba(95,114,140,0.4) 345deg, transparent 360deg)",
              }}
            />
            <div className="relative rounded-[calc(1rem-1px)] border border-[rgba(168,184,204,0.12)] bg-[rgba(26,28,34,0.85)] p-6 backdrop-blur-xl">
              {/* label only up top — the revenue figure lives with its
                  sparkline below, clear of the invoice satellite that
                  overlaps this card's top-right corner */}
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#7a8699]">This week</p>

              <div className="mt-5 space-y-1">
                {[
                  { name: "Maya R.", detail: "SAT prep · Tue 4:00", amount: "$120", paid: true },
                  { name: "Chen family", detail: "Algebra II · Wed 5:30", amount: "$320", paid: true },
                  { name: "Deshi O.", detail: "Chemistry · Thu 6:00", amount: "$180", paid: false },
                ].map((row) => (
                  <div key={row.name} className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition duration-150 hover:bg-[rgba(168,184,204,0.05)]">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(95,114,140,0.25)] text-xs font-semibold text-[#a8b8cc]">
                      {row.name[0]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#e8ecf2]">{row.name}</p>
                      <p className="truncate text-xs text-[#7a8699]">{row.detail}</p>
                    </div>
                    <p className="tabular-nums text-sm font-medium text-[#e8ecf2]">{row.amount}</p>
                    <span
                      aria-hidden
                      className={
                        row.paid
                          ? "h-2 w-2 shrink-0 rounded-full bg-[#5f728c] shadow-[0_0_8px_rgba(95,114,140,0.9)]"
                          : "h-2 w-2 shrink-0 rounded-full border border-[#7a8699]"
                      }
                    />
                  </div>
                ))}
              </div>

              {/* revenue sparkline, drawing itself in */}
              <div className="mt-4 border-t border-[rgba(168,184,204,0.1)] pt-4">
                <div className="flex items-baseline justify-between">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#7a8699]">Collected</p>
                  <p
                    key={revenue}
                    className="tabular-nums text-2xl font-semibold text-[#f7f7f7] motion-safe:animate-[num-pop_0.45s_ease-out]"
                  >
                    {revenue}
                  </p>
                </div>
                <svg viewBox="0 0 320 48" className="h-12 w-full" aria-hidden>
                  <defs>
                    <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#5f728c" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#5f728c" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0 40 C 40 38, 60 30, 90 31 C 130 32, 150 20, 190 18 C 230 16, 250 10, 320 6 L 320 48 L 0 48 Z" fill="url(#spark-fill)" className="motion-safe:animate-[fade-rise-in_1s_ease-out_2.2s_both]" />
                  <path
                    d="M0 40 C 40 38, 60 30, 90 31 C 130 32, 150 20, 190 18 C 230 16, 250 10, 320 6"
                    fill="none"
                    stroke="#a8b8cc"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray="360"
                    strokeDashoffset="360"
                    style={{ filter: "drop-shadow(0 0 6px rgba(95,114,140,0.8))" }}
                    className="motion-safe:animate-[draw-line_1.4s_ease-out_1.5s_both] motion-reduce:[stroke-dashoffset:0]"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Invoice satellite — resolves Sent → Paid on the story beat. Outer
            div owns position + depth + rotation; inner div owns the transform
            animations (they'd stomp each other on one element). */}
        <div className="absolute -right-2 -top-8 z-20 w-52 sm:-right-6" style={{ transform: "translateZ(50px) rotate(2deg)" }}>
          <div className={`${glass} p-4 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.7)] motion-safe:animate-[card-enter_0.8s_ease-out_0.85s_both,scene-float_8s_ease-in-out_2s_infinite]`}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-[#7a8699]">Invoice #47</p>
              <span className="relative inline-flex h-6 w-14 items-center justify-center">
                <span className="absolute inline-flex items-center rounded-full border border-[#7a8699] px-2.5 py-0.5 text-[11px] font-medium text-[#a8b8cc] opacity-0 motion-safe:animate-[pill-sent_9s_ease-in-out_3s_infinite]">
                  Sent
                </span>
                <span className="absolute inline-flex items-center rounded-full bg-[#5f728c] px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-[0_0_16px_rgba(95,114,140,0.7)] motion-safe:animate-[pill-paid_9s_ease-in-out_3s_infinite]">
                  Paid
                </span>
              </span>
            </div>
            <p className="mt-3 tabular-nums text-xl font-semibold text-[#f7f7f7]">$320.00</p>
            <p className="mt-0.5 text-xs text-[#7a8699]">Chen family · Net 7</p>
          </div>
        </div>

        {/* Reminder chip — small sign of the machine working. Sits mostly
            clear of the card's left edge so it reads as its own object. */}
        <div className="absolute -left-4 top-4 z-20 sm:-left-12" style={{ transform: "translateZ(-30px)" }}>
          <div className={`${glass} flex items-center gap-2 rounded-full px-3.5 py-2 motion-safe:animate-[card-enter_0.8s_ease-out_1.15s_both,scene-float_9s_ease-in-out_2.4s_infinite]`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a8b8cc" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" />
            </svg>
            <p className="whitespace-nowrap text-[11px] text-[#a8b8cc]">Reminder sent · 6:00 PM</p>
          </div>
        </div>

        {/* Payment toast — arrives like a live notification, kicks off the beat */}
        <div className="absolute -bottom-10 -left-3 z-30 w-64 sm:-left-10" style={{ transform: "translateZ(70px)" }}>
          <div className={`${glass} flex items-center gap-3 p-4 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.75),0_0_50px_-12px_rgba(95,114,140,0.4)] motion-safe:animate-[toast-cycle_9s_ease-in-out_3s_infinite]`}>
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#5f728c]">
              <span aria-hidden className="absolute inset-0 rounded-full border border-[#5f728c] motion-safe:animate-[ring-pulse_2.4s_ease-out_infinite]" />
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f7f7f7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#f7f7f7]">Payment received</p>
              <p className="truncate text-xs text-[#a8b8cc]">
                <span className="tabular-nums">$240.00</span> · Chen family
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
