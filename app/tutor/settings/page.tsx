import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireTutor } from "@/lib/auth/tutor";
import { SettingsForm } from "@/components/settings/settings-form";
import { StripeConnectSection } from "@/components/settings/stripe-connect-section";
import { ReminderTemplatesForm } from "@/components/settings/reminder-templates-form";
import { PublicProfileForm } from "@/components/settings/public-profile-form";
import { IcalFeedSection } from "@/components/settings/ical-feed-section";
import { CopyButton } from "@/components/ui/copy-button";
import { getStripeAccountStatus, isStripeConfigured } from "@/lib/stripe/client";
import { tutorCodeLink } from "@/lib/tutor-code-link";
import { isSmsConfigured } from "@/lib/sms";
import type { ReminderTemplates } from "@/lib/reminders";

export default async function SettingsPage() {
  const tutor = await requireTutor();

  const status = tutor.stripe_account_id ? await getStripeAccountStatus(tutor.stripe_account_id) : null;

  return (
    <div>
      <PageHeader title="Settings" description="Standard rate, travel rule, invoice terms, payments, and reminders." />
      <div className="space-y-6">
        <Card className="max-w-2xl">
          <SettingsForm tutor={tutor} smsConfigured={isSmsConfigured()} />
        </Card>

        <Card className="max-w-2xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold">Services</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Named, flat-priced offerings — e.g. a diagnostic assessment separate from your hourly rate.
              </p>
            </div>
            <Link href="/tutor/settings/services" className="shrink-0">
              <Button variant="secondary" size="sm" className="w-full sm:w-auto">
                Manage services
              </Button>
            </Link>
          </div>
        </Card>

        <Card className="max-w-2xl">
          <h2 className="mb-1 text-sm font-semibold">Tutor code</h2>
          <p className="mb-4 text-sm text-text-secondary">
            One link for any new parent — they join, add their child (or pick one of your unclaimed
            students), and land in their portal. Per-student Student Codes still work too.
          </p>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-sunken px-4 py-3">
            <code className="flex-1 truncate text-sm">{tutorCodeLink(tutor.tutor_code)}</code>
            <CopyButton value={tutorCodeLink(tutor.tutor_code)} size="sm" />
          </div>
        </Card>

        <Card className="max-w-2xl">
          <h2 className="mb-1 text-sm font-semibold">Public profile</h2>
          <p className="mb-4 text-sm text-text-secondary">
            A shareable page with your bio, subjects, and services. No login required to view.
          </p>
          <PublicProfileForm tutor={tutor} />
        </Card>

        <Card className="max-w-2xl">
          <h2 className="mb-1 text-sm font-semibold">Calendar sync</h2>
          <p className="mb-4 text-sm text-text-secondary">
            Subscribe to this link from Google, Apple, or Outlook Calendar to see your upcoming Slate sessions.
            Read-only — nothing you do in your calendar app changes Slate.
          </p>
          <IcalFeedSection token={tutor.ical_token ?? ""} />
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
