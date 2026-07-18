"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import clsx from "clsx";

type Variant = "up" | "scale" | "left" | "right";

const HIDDEN: Record<Variant, string> = {
  up: "motion-safe:opacity-0 motion-safe:translate-y-4",
  scale: "motion-safe:opacity-0 motion-safe:scale-95",
  left: "motion-safe:opacity-0 motion-safe:-translate-x-8",
  right: "motion-safe:opacity-0 motion-safe:translate-x-8",
};

const SHOWN =
  "motion-safe:opacity-100 motion-safe:translate-y-0 motion-safe:translate-x-0 motion-safe:scale-100";

/**
 * Fade+rise (or scale/slide) on scroll into view. Under prefers-reduced-motion
 * the `motion-safe:` classes never apply, so content just renders at its
 * final opacity/position with no animation at all.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  variant = "up",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  variant?: Variant;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={clsx(
        "motion-safe:transition motion-safe:duration-500 motion-safe:ease-out",
        visible ? SHOWN : HIDDEN[variant],
        className
      )}
    >
      {children}
    </div>
  );
}
