import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireTutor } from "@/lib/auth/tutor";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/settings/settings-form";
import { StripeConnectSection } from "@/components/settings/stripe-connect-section";
import { PublicProfileForm } from "@/components/settings/public-profile-form";
import { IcalFeedSection } from "@/components/settings/ical-feed-section";
import { CopyButton } from "@/components/ui/copy-button";
import { ShareButton } from "@/components/ui/share-button";
import { getStripeAccountStatus, isStripeConfigured } from "@/lib/stripe/client";
import { tutorCodeLink } from "@/lib/tutor-code-link";
import { isSmsConfigured } from "@/lib/sms";

export default async function SettingsPage() {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const [status, { data: services }] = await Promise.all([
    tutor.stripe_account_id ? getStripeAccountStatus(tutor.stripe_account_id) : Promise.resolve(null),
    supabase
      .from("services")
      .select("id, name, description, duration_minutes, price_cents")
      .eq("tutor_id", tutor.id)
      .eq("is_active", true)
      .order("sort_order")
      .order("created_at"),
  ]);

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
            <code className="min-w-0 flex-1 truncate text-sm">{tutorCodeLink(tutor.tutor_code)}</code>
            {/*
              This code is assigned once at signup (Q7) and never
              regenerates from this page, so it's a stable re-view, not a
              generation event — manual copy + toast, no auto-copy-on-load.
            */}
            <CopyButton value={tutorCodeLink(tutor.tutor_code)} size="sm" toastMessage="Tutor code link copied" />
            <ShareButton title="Join me on Slate" text="Use this link to join and see your child's sessions." url={tutorCodeLink(tutor.tutor_code)} />
          </div>
        </Card>

        <Card className="max-w-4xl">
          <h2 className="mb-1 text-sm font-semibold">Public page</h2>
          <p className="mb-4 text-sm text-text-secondary">
            A shareable page with your photo, bio, and services — customizable, with the Slate frame kept.
            No login required to view. Reorder which services show (and in what order) from{" "}
            <Link href="/tutor/settings/services" className="underline hover:text-text">
              Services
            </Link>
            .
          </p>
          <PublicProfileForm tutor={tutor} services={services ?? []} />
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold">Email center</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Templates for booking, reminders, and invoices, with a live preview and your own notification settings.
              </p>
            </div>
            <Link href="/tutor/settings/email" className="shrink-0">
              <Button variant="secondary" size="sm" className="w-full sm:w-auto">
                Open email center
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
