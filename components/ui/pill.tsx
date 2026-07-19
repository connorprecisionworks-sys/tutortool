import { type ReactNode } from "react";
import clsx from "clsx";

/**
 * Shared subtle inline tag idiom (small text, hairline border, no fill) —
 * per design-system.md's "weight and a small dot, not loud color badges"
 * rule. Used for both state markers (PrivacyPill) and static labels
 * (the "Optional" tag on the dashboard checklist) so every small pill in
 * the app renders identically.
 */
export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-block rounded-full border border-border px-1.5 py-0.5 align-middle text-[10px] font-normal uppercase tracking-wide text-text-tertiary",
        className
      )}
    >
      {children}
    </span>
  );
}
