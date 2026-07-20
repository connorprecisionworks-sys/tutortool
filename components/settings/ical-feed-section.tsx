"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { useToast } from "@/components/ui/toast";
import { regenerateIcalTokenAction } from "@/app/tutor/settings/actions";
import { icalFeedUrl } from "@/lib/ical-feed-link";

export function IcalFeedSection({ token }: { token: string }) {
  const { toast } = useToast();
  const [currentToken, setCurrentToken] = useState(token);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function regenerate() {
    setError(null);
    startTransition(async () => {
      const result = await regenerateIcalTokenAction();
      if (result.error || !result.token) {
        setError(result.error ?? "Could not regenerate the link.");
        return;
      }
      setCurrentToken(result.token);
      setConfirming(false);
      // E3 (build-queue.md): Regenerate is the one moment this URL is
      // genuinely "just generated" — the initial page-load URL below stays
      // manual-copy-only (see its CopyButton's toastMessage), since viewing
      // Settings isn't a generation event.
      try {
        await navigator.clipboard.writeText(icalFeedUrl(result.token));
        toast("New feed link copied to clipboard", { variant: "success" });
      } catch {
        toast("New feed link generated — copy it below");
      }
    });
  }

  return (
    <div>
      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-sunken px-4 py-3">
        <code className="min-w-0 flex-1 truncate text-sm">{icalFeedUrl(currentToken)}</code>
        <CopyButton value={icalFeedUrl(currentToken)} size="sm" toastMessage="Feed link copied to clipboard" />
      </div>
      {error && <p className="mt-2 text-sm text-text">{error}</p>}
      <div className="mt-3">
        {confirming ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">Old link stops working immediately. Continue?</span>
            <Button variant="secondary" size="sm" disabled={pending} onClick={regenerate}>
              {pending ? "Regenerating…" : "Yes, regenerate"}
            </Button>
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming(false)}>
              Never mind
            </Button>
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
            Regenerate link
          </Button>
        )}
      </div>
    </div>
  );
}
