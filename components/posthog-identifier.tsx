"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

interface PostHogIdentifierProps {
  distinctId: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
}

export function PostHogIdentifier({ distinctId, name, email, role }: PostHogIdentifierProps) {
  useEffect(() => {
    posthog.identify(distinctId, {
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
      ...(role ? { role } : {}),
    });
  }, [distinctId, name, email, role]);

  return null;
}
