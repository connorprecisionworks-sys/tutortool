"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { connectStripeAction } from "@/app/tutor/settings/stripe-actions";

export function StripeConnectSection({
  stripeConfigured,
  hasAccount,
  chargesEnabled,
}: {
  stripeConfigured: boolean;
  hasAccount: boolean;
  chargesEnabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function connect() {
    startTransition(async () => {
      const result = await connectStripeAction();
      if (result.error) setError(result.error);
      else if (result.url) window.location.href = result.url;
    });
  }

  if (!stripeConfigured) {
    return (
      <p className="text-sm text-text-secondary">
        Stripe isn&apos;t configured on this deployment yet. Once your developer adds API keys, you&apos;ll
        be able to connect an account here and send real payment links.
      </p>
    );
  }

  if (hasAccount && chargesEnabled) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-text">Connected — you can accept card payments.</p>
        <Button variant="secondary" size="sm" disabled={pending} onClick={connect}>
          {pending ? "Opening…" : "Update account details"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-text-secondary">
        {hasAccount
          ? "Onboarding isn't finished yet — Stripe still needs a few details before you can accept payments."
          : "Connect a Stripe account so invoice payment links go straight to you."}
      </p>
      <Button disabled={pending} onClick={connect}>
        {pending ? "Opening…" : hasAccount ? "Finish onboarding" : "Connect with Stripe"}
      </Button>
      {error && <p className="text-sm text-text">{error}</p>}
    </div>
  );
}
