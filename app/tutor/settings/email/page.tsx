import Link from "next/link";
import { requireTutor } from "@/lib/auth/tutor";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmailCenter } from "@/components/settings/email-center";
import type { ReminderTemplates } from "@/lib/reminders";
import type { CustomEmailTemplate } from "@/lib/email-templates";
import type { NotificationSettings } from "@/lib/notification-settings";

export default async function EmailCenterPage() {
  const tutor = await requireTutor();

  return (
    <div>
      <PageHeader
        title="Email center"
        description="Templates for every automatic email, plus your own, with a live preview. Booking and billing emails to parents send as you, via Slate."
        action={
          <Link href="/tutor/settings">
            <Button variant="ghost" size="sm">
              Back to settings
            </Button>
          </Link>
        }
      />
      <Card className="max-w-2xl">
        <EmailCenter
          reminderTemplates={(tutor.reminder_templates as unknown as ReminderTemplates) ?? {}}
          customTemplates={(tutor.custom_email_templates as unknown as CustomEmailTemplate[]) ?? []}
          notificationSettings={tutor.notification_settings as unknown as NotificationSettings | null}
        />
      </Card>
    </div>
  );
}
