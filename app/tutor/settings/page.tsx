import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireTutor } from "@/lib/auth/tutor";
import { SettingsForm } from "@/components/settings/settings-form";
import { StripeConnectSection } from "@/components/settings/stripe-connect-section";
import { ReminderTemplatesForm } from "@/components/settings/reminder-templates-form";
import { getStripeAccountStatus, isStripeConfigured } from "@/lib/stripe/client";
import type { ReminderTemplates } from "@/lib/reminders";

export default async function SettingsPage() {
  const tutor = await requireTutor();

  const status = tutor.stripe_account_id ? await getStripeAccountStatus(tutor.stripe_account_id) : null;

  return (
    <div>
      <PageHeader title="Settings" description="Standard rate, travel rule, invoice terms, payments, and reminders." />
      <div className="space-y-6">
        <Card className="max-w-2xl">
          <SettingsForm tutor={tutor} />
        </Card>

        <Card className="max-w-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Services</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Named, flat-priced offerings — e.g. a diagnostic assessment separate from your hourly rate.
              </p>
            </div>
            <Link href="/tutor/settings/services">
              <Button variant="secondary" size="sm">
                Manage services
              </Button>
            </Link>
          </div>
        </Card>

        <Card className="max-w-2xl">
          <h2 className="mb-3 text-sm font-semibold">Payments</h2>
          <StripeConnectSection
            stripeConfigured={isStripeConfigured()}
            hasAccount={Boolean(tutor.stripe_account_id)}
            chargesEnabled={status?.chargesEnabled ?? false}
          />
        </Card>

        <Card className="max-w-2xl">
          <h2 className="mb-3 text-sm font-semibold">Reminder templates</h2>
          <ReminderTemplatesForm templates={tutor.reminder_templates as unknown as ReminderTemplates} />
        </Card>
      </div>
    </div>
  );
}
