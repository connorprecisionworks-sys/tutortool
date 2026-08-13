import type { IconName } from "@/lib/nav";

/**
 * The sidebar's icon set. Inline SVG (no icon dependency), single stroke
 * weight, currentColor — so an icon is just text that happens to be a shape
 * and inherits every hover/active color rule the nav item already has.
 *
 * Kept deliberately plain: these exist so a collapsed sidebar is still
 * navigable, not as decoration.
 */
const PATHS: Record<IconName, React.ReactNode> = {
  home: <path d="M3.5 10.5 12 3.5l8.5 7M6 9.5V19a1.5 1.5 0 0 0 1.5 1.5H10V15h4v5.5h2.5A1.5 1.5 0 0 0 18 19V9.5" />,
  users: (
    <>
      <circle cx="9.5" cy="8" r="3.2" />
      <path d="M3.5 20v-1.2A3.8 3.8 0 0 1 7.3 15h4.4a3.8 3.8 0 0 1 3.8 3.8V20" />
      <path d="M16.5 5.4a3 3 0 0 1 0 5.2M17.5 15.2A3.5 3.5 0 0 1 20.5 18.6V20" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
      <path d="M8 3.5v4M16 3.5v4M3.5 10.5h17" />
    </>
  ),
  wallet: (
    <>
      <path d="M3.5 8.5A2.5 2.5 0 0 1 6 6h12a2.5 2.5 0 0 1 2.5 2.5v9A2.5 2.5 0 0 1 18 20H6a2.5 2.5 0 0 1-2.5-2.5z" />
      <path d="M20.5 11H16.5a1.5 1.5 0 0 0 0 3h4" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7.5h8M18 7.5h2M4 16.5h2M12 16.5h8" />
      <circle cx="15" cy="7.5" r="2.2" />
      <circle cx="9" cy="16.5" r="2.2" />
    </>
  ),
  folder: <path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h3.8l2 2.5H19a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </>
  ),
};

export function NavIcon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}
