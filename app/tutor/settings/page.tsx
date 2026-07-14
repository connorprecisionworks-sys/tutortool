import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { requireTutor } from "@/lib/auth/tutor";
import { SettingsForm } from "@/components/settings/settings-form";
import { StripeConnectSection } from "@/components/settings/stripe-connect-section";
import { getStripeAccountStatus, isStripeConfigured } from "@/lib/stripe/client";

export default async function SettingsPage() {
  const tutor = await requireTutor();

  const status = tutor.stripe_account_id ? await getStripeAccountStatus(tutor.stripe_account_id) : null;

  return (
    <div>
      <PageHeader title="Settings" description="Standard rate, travel rule, invoice terms, and payments." />
      <div className="space-y-6">
        <Card className="max-w-2xl">
          <SettingsForm tutor={tutor} />
        </Card>

        <Card className="max-w-2xl">
          <h2 className="mb-3 text-sm font-semibold">Payments</h2>
          <StripeConnectSection
            stripeConfigured={isStripeConfigured()}
            hasAccount={Boolean(tutor.stripe_account_id)}
            chargesEnabled={status?.chargesEnabled ?? false}
          />
        </Card>
      </div>
    </div>
  );
}
