import { Pill } from "@/components/ui/pill";

/**
 * Inline marker for a note's visibility (D5). No default margin baked in —
 * Tailwind's generated stylesheet always defines `.ml-2` after `.ml-0`
 * regardless of class attribute order, so a hardcoded default margin here
 * can't be zeroed out by a caller's className. Every call site passes its
 * own spacing instead.
 */
export function PrivacyPill({ shared, className }: { shared: boolean; className?: string }) {
  return <Pill className={className}>{shared ? "Shared with parent" : "Private"}</Pill>;
}
