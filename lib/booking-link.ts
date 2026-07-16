import { publicAppUrl } from "@/lib/app-url";

export function bookingLink(token: string): string {
  return `${publicAppUrl()}/book/${token}`;
}
