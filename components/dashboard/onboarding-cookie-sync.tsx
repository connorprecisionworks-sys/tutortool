"use client";

import { useEffect, useRef } from "react";
import { ackOnboardingAction } from "@/app/onboarding/actions";

/**
 * Silently persists the C1 gate's "cleared" cookie the first time a tutor
 * lands on the dashboard with every required step already done — e.g. they
 * set their rate/handle/etc. straight from Settings rather than through the
 * /onboarding wizard. Without this, app/tutor/layout.tsx's gate check would
 * keep re-running its status query on every navigation for the rest of the
 * session (harmless, but wasted work) instead of short-circuiting on the
 * cookie like it does for everyone else.
 */
export function OnboardingCookieSync() {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void ackOnboardingAction();
  }, []);

  return null;
}
