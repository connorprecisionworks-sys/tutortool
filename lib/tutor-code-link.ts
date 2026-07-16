import { publicAppUrl } from "@/lib/app-url";

export function tutorCodeLink(code: string): string {
  return `${publicAppUrl()}/join?tutor_code=${code}`;
}
