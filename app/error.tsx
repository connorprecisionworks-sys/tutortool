"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    posthog.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold text-text">Something went wrong</h1>
      <p className="max-w-sm text-sm text-text-secondary">
        An unexpected error occurred. It&rsquo;s been logged — try again, or come back later.
      </p>
      <button
        onClick={() => reset()}
        className="mt-2 inline-flex h-9 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-text transition hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
