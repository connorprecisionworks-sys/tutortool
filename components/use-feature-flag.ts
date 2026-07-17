"use client";

import { useEffect, useState } from "react";
import posthog from "posthog-js";

/**
 * Client-side feature flag hook. Reads from the singleton `posthog-js` client
 * that `instrumentation-client.ts` already initialises, so no PostHogProvider
 * is required.
 *
 * Returns `undefined` on the first render (flags not loaded yet), then the
 * resolved boolean once PostHog has fetched flags for the current user.
 * Guard your UI on the boolean to avoid a flash of the wrong variant:
 *
 *   const showNewEditor = useFeatureFlag("new-invoice-editor");
 *   if (showNewEditor === undefined) return null; // or a skeleton
 *   return showNewEditor ? <NewEditor /> : <OldEditor />;
 */
export function useFeatureFlag(key: string): boolean | undefined {
  const [enabled, setEnabled] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    // onFeatureFlags fires once flags are loaded and again if they change
    // (e.g. after identify), so the value stays correct across a login.
    const unsubscribe = posthog.onFeatureFlags(() => {
      setEnabled(posthog.isFeatureEnabled(key) ?? false);
    });
    return () => {
      unsubscribe?.();
    };
  }, [key]);

  return enabled;
}

/**
 * Multivariate variant hook. Returns the variant key string, `false` when the
 * flag is off, or `undefined` while flags are still loading.
 */
export function useFeatureFlagVariant(key: string): string | boolean | undefined {
  const [variant, setVariant] = useState<string | boolean | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = posthog.onFeatureFlags(() => {
      setVariant(posthog.getFeatureFlag(key) ?? false);
    });
    return () => {
      unsubscribe?.();
    };
  }, [key]);

  return variant;
}
