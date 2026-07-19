export interface NotificationSettings {
  tutor_new_booking?: boolean;
  parent_booking_confirmation?: boolean;
  parent_session_reminder?: boolean;
  parent_invoice_reminders?: boolean;
  parent_auto_invoice?: boolean;
}

export const NOTIFICATION_TOGGLES: {
  key: keyof NotificationSettings;
  audience: "tutor" | "parent";
  label: string;
  description: string;
}[] = [
  {
    key: "tutor_new_booking",
    audience: "tutor",
    label: "New booking alert",
    description: "Email me when a parent books a session.",
  },
  {
    key: "parent_booking_confirmation",
    audience: "parent",
    label: "Booking confirmation",
    description: "Email parents when they book a session.",
  },
  {
    key: "parent_session_reminder",
    audience: "parent",
    label: "Session reminder",
    description: "Email parents shortly before an upcoming session.",
  },
  {
    key: "parent_invoice_reminders",
    audience: "parent",
    label: "Invoice reminders",
    description: "Email parents when an invoice is due or past due.",
  },
  {
    key: "parent_auto_invoice",
    audience: "parent",
    label: "Auto-invoice sent",
    description: "Email parents when auto-invoicing generates and sends an invoice.",
  },
];

/** Absent key means "on" — existing tutors keep today's always-on behavior until they opt out. */
export function isNotificationEnabled(
  settings: NotificationSettings | null | undefined,
  key: keyof NotificationSettings
): boolean {
  return settings?.[key] !== false;
}
