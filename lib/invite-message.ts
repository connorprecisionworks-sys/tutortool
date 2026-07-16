export function buildInviteMessage({
  studentName,
  parentName,
  link,
  code,
}: {
  studentName: string;
  parentName?: string | null;
  link: string;
  code: string;
}): string {
  const greeting = parentName?.trim() ? `Hi ${parentName.trim()},` : "Hi,";
  return `${greeting} I use Slate to share ${studentName}'s tutoring, notes, schedule, and invoices. Join here: ${link} (code ${code}).`;
}
