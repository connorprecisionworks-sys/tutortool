import clsx from "clsx";

/**
 * Inline marker for a note's visibility (D5) — reuses the same subtle
 * pill idiom already established for the "Optional" tag on the dashboard
 * checklist, per design-system.md's "weight and a small dot, not loud
 * color badges" rule (monochrome, no red/green).
 *
 * No default margin baked in — Tailwind's generated stylesheet always
 * defines `.ml-2` after `.ml-0` regardless of class attribute order, so a
 * hardcoded default margin here can't be zeroed out by a caller's
 * className. Every call site passes its own spacing instead.
 */
export function PrivacyPill({ shared, className }: { shared: boolean; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-block rounded-full border border-border px-1.5 py-0.5 align-middle text-[10px] font-normal uppercase tracking-wide text-text-tertiary",
        className
      )}
    >
      {shared ? "Shared with parent" : "Private"}
    </span>
  );
}
