"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { getResourceUrlAction } from "@/app/resources/actions";

export function OpenResourceButton({ resourceId, label }: { resourceId: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function open() {
    // Open the tab synchronously in the click handler (not after the
    // await below) so browser popup blockers treat it as user-initiated;
    // we redirect it to the real URL once the signed link comes back.
    // Deliberately NOT passing "noopener" here — per spec that makes
    // window.open() return null unconditionally, which would leave us with
    // no handle to navigate later. Sever the opener link manually instead
    // (same security benefit — the opened page can't reach window.opener)
    // so we keep a usable reference.
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    startTransition(async () => {
      const result = await getResourceUrlAction(resourceId);
      if (result.error) {
        setError(result.error);
        tab?.close();
      } else if (result.url && tab) {
        tab.location.href = result.url;
      }
    });
  }

  return (
    <div>
      <Button variant="ghost" size="sm" disabled={pending} onClick={open}>
        {pending ? "Opening…" : label}
      </Button>
      {error && <p className="text-xs text-text">{error}</p>}
    </div>
  );
}
