import { publicAppUrl } from "@/lib/app-url";

export function studentJoinLink(code: string): string {
  return `${publicAppUrl()}/join?code=${code}`;
}
