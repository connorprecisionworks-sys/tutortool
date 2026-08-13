/**
 * App navigation.
 *
 * Consolidated 2026-08: the tutor sidebar used to list 11 flat destinations
 * (Dashboard, Insights, Students, Sessions, Invoices, Packages, Schedule,
 * Booking Links, Resources, Expenses, Settings). That's more choices than
 * anyone can hold in their head, and it made the sidebar the busiest thing
 * on screen. It's now 5 sections, each owning a small set of pages that get
 * a quiet sub-tab row inside the page instead of their own sidebar line.
 *
 * No routes moved — this is purely how they're grouped and presented.
 */

export type IconName = "home" | "users" | "calendar" | "wallet" | "settings" | "folder" | "clock";

export interface NavItem {
  href: string;
  label: string;
}

export interface NavSection extends NavItem {
  icon: IconName;
  /**
   * Pages that live under this section, shown as a sub-tab row at the top of
   * the content area. Omit for a section that is a single page (the parent
   * portal's items). The section's own `href` should be the first child —
   * clicking the sidebar item lands you on the section's default page.
   */
  children?: NavItem[];
}

export const TUTOR_NAV: NavSection[] = [
  {
    href: "/tutor",
    label: "Home",
    icon: "home",
    children: [
      { href: "/tutor", label: "Overview" },
      { href: "/tutor/insights", label: "Insights" },
    ],
  },
  {
    href: "/tutor/students",
    label: "Students",
    icon: "users",
    children: [
      { href: "/tutor/students", label: "Students" },
      { href: "/tutor/resources", label: "Resources" },
    ],
  },
  {
    href: "/tutor/sessions",
    label: "Schedule",
    icon: "calendar",
    children: [
      { href: "/tutor/sessions", label: "Sessions" },
      { href: "/tutor/schedule", label: "Availability" },
      { href: "/tutor/booking-links", label: "Booking links" },
    ],
  },
  {
    href: "/tutor/invoices",
    label: "Money",
    icon: "wallet",
    children: [
      { href: "/tutor/invoices", label: "Invoices" },
      { href: "/tutor/packages", label: "Packages" },
      { href: "/tutor/expenses", label: "Expenses" },
    ],
  },
  {
    href: "/tutor/settings",
    label: "Settings",
    icon: "settings",
    children: [
      { href: "/tutor/settings", label: "General" },
      { href: "/tutor/settings/services", label: "Services" },
      { href: "/tutor/settings/email", label: "Email" },
    ],
  },
];

export const PARENT_NAV: NavSection[] = [
  { href: "/parent", label: "Home", icon: "home" },
  { href: "/parent/sessions", label: "Sessions", icon: "calendar" },
  { href: "/parent/resources", label: "Resources", icon: "folder" },
  { href: "/parent/schedule", label: "Schedule", icon: "clock" },
  { href: "/parent/billing", label: "Billing", icon: "wallet" },
];

/** A section with no `children` behaves as a section owning exactly one page. */
export function sectionPages(section: NavSection): NavItem[] {
  return section.children ?? [{ href: section.href, label: section.label }];
}

/** Flat list of every destination — what the command palette searches. */
export function flattenNav(sections: NavSection[]): NavItem[] {
  return sections.flatMap(sectionPages);
}

/**
 * Which section/page is current, by *longest* matching href across every
 * page in every section.
 *
 * Longest-match matters twice over, and a naive `startsWith` gets both wrong:
 *   - "/tutor/students" would also match Home's "/tutor" (every tutor route
 *     is prefixed by it) — the old shell worked around this with a
 *     segment-count special case.
 *   - "/tutor/settings/services" would also match Settings' own
 *     "/tutor/settings" ("General"), lighting up two sub-tabs at once.
 * Taking the longest match resolves both without special-casing anything,
 * and nested detail routes (/tutor/students/[id], /tutor/settings/services/new)
 * land on the right tab for free.
 */
export function resolveNav(
  pathname: string,
  sections: NavSection[]
): { section?: NavSection; page?: NavItem } {
  let best: { section: NavSection; page: NavItem } | undefined;
  for (const section of sections) {
    for (const page of sectionPages(section)) {
      const matches = pathname === page.href || pathname.startsWith(`${page.href}/`);
      if (!matches) continue;
      if (!best || page.href.length > best.page.href.length) best = { section, page };
    }
  }
  return best ?? {};
}
