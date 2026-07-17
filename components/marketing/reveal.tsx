"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import clsx from "clsx";

/**
 * Fade+rise on scroll into view. Under prefers-reduced-motion the
 * `motion-safe:` classes never apply, so content just renders at its
 * final opacity/position with no animation at all.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
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
        "motion-safe:transition motion-safe:duration-700 motion-safe:ease-out",
        visible ? "motion-safe:opacity-100 motion-safe:translate-y-0" : "motion-safe:opacity-0 motion-safe:translate-y-4",
        className
      )}
    >
      {children}
    </div>
  );
}
