"use client";

import { useEffect, useRef, useState } from "react";
import { DashboardMockup } from "@/components/marketing/mockups";
import { Reveal } from "@/components/marketing/reveal";

/**
 * Scale+fade entrance, a slow idle float, and a soft scroll parallax —
 * each on its own nested element so the transforms don't fight each other.
 * Parallax is skipped under prefers-reduced-motion and on small screens
 * (cheap on desktop, unnecessary jank risk on mobile).
 */
export function HeroMockup() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isSmallScreen = window.matchMedia("(max-width: 639px)").matches;
    if (reduceMotion || isSmallScreen) return;

    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const el = wrapperRef.current;
        if (el) {
          const rect = el.getBoundingClientRect();
          const progress = Math.min(Math.max(-rect.top / (rect.height || 1), -1), 1);
          setOffset(progress * 24);
        }
        ticking = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div ref={wrapperRef} style={{ transform: `translateY(${offset}px)` }} className="will-change-transform">
      <div className="motion-safe:animate-[float_6s_ease-in-out_infinite]">
        <Reveal delay={240} variant="scale" className="mx-auto max-w-4xl">
          <DashboardMockup className="mx-auto" />
        </Reveal>
      </div>
    </div>
  );
}
