import { publicAppUrl } from "@/lib/app-url";

export function icalFeedUrl(token: string): string {
  return `${publicAppUrl()}/api/ical/${token}`;
}
