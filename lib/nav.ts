import type { NavItem } from "@/components/shell/app-shell";

export const TUTOR_NAV: NavItem[] = [
  { href: "/tutor", label: "Dashboard" },
  { href: "/tutor/students", label: "Students" },
  { href: "/tutor/sessions", label: "Sessions" },
  { href: "/tutor/invoices", label: "Invoices" },
  { href: "/tutor/packages", label: "Packages" },
  { href: "/tutor/schedule", label: "Schedule" },
  { href: "/tutor/booking-links", label: "Booking Links" },
  { href: "/tutor/resources", label: "Resources" },
  { href: "/tutor/settings", label: "Settings" },
];

export const PARENT_NAV: NavItem[] = [
  { href: "/parent", label: "Home" },
  { href: "/parent/sessions", label: "Sessions & Notes" },
  { href: "/parent/resources", label: "Resources" },
  { href: "/parent/schedule", label: "Schedule" },
  { href: "/parent/billing", label: "Billing" },
];
