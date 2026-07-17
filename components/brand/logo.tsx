import Image from "next/image";
import clsx from "clsx";

// Intrinsic dimensions from each SVG's viewBox — next/image requires
// width/height to reserve layout space and avoid CLS; every call site only
// constrains height via className (e.g. "h-6"), so the browser's built-in
// width-from-aspect-ratio behavior (derived from these width/height
// attributes) keeps width auto, same visual result as the old plain <img>
// with "h-full w-auto".
const LOGO_SIZE = { width: 886, height: 236 };
const MARK_SIZE = { width: 546, height: 768 };

/** Horizontal lockup (mark + "SLATE" + tagline). Swaps on-light/on-dark via CSS, no JS/hydration cost. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={clsx("relative inline-block", className)}>
      <Image src="/brand/logo/slate-logo-on-light.svg" alt="Slate" {...LOGO_SIZE} className="logo-light h-full w-auto" />
      <Image src="/brand/logo/slate-logo-on-dark.svg" alt="Slate" {...LOGO_SIZE} className="logo-dark h-full w-auto" />
    </span>
  );
}

/** Bare S mark, no wordmark — for tight spaces like the app shell sidebar header. */
export function Mark({ className }: { className?: string }) {
  return (
    <span className={clsx("relative inline-block", className)}>
      <Image src="/brand/logo/slate-mark-on-light.svg" alt="Slate" {...MARK_SIZE} className="logo-light h-full w-auto" />
      <Image src="/brand/logo/slate-mark-on-dark.svg" alt="Slate" {...MARK_SIZE} className="logo-dark h-full w-auto" />
    </span>
  );
}
