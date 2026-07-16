import clsx from "clsx";

/** Horizontal lockup (mark + "SLATE" + tagline). Swaps on-light/on-dark via CSS, no JS/hydration cost. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={clsx("relative inline-block", className)}>
      <img src="/brand/logo/slate-logo-on-light.svg" alt="Slate" className="logo-light h-full w-auto" />
      <img src="/brand/logo/slate-logo-on-dark.svg" alt="Slate" className="logo-dark h-full w-auto" />
    </span>
  );
}

/** Bare S mark, no wordmark — for tight spaces like the app shell sidebar header. */
export function Mark({ className }: { className?: string }) {
  return (
    <span className={clsx("relative inline-block", className)}>
      <img src="/brand/logo/slate-mark-on-light.svg" alt="Slate" className="logo-light h-full w-auto" />
      <img src="/brand/logo/slate-mark-on-dark.svg" alt="Slate" className="logo-dark h-full w-auto" />
    </span>
  );
}
