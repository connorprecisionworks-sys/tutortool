"use client";

import { useState, useTransition } from "react";
import { getReceiptUrlAction } from "@/app/tutor/expenses/actions";

export function ReceiptLink({ expenseId }: { expenseId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function open() {
    setError(null);
    // Open a blank tab synchronously, inside the click handler, then point
    // it at the signed URL once fetched — real browsers' popup blockers
    // silently drop window.open() calls that happen after an await, even
    // from a genuine click gesture, so opening after the async round trip
    // (like the codebase's usual window.open(url, "_blank", "noopener")
    // pattern) would work in this headless QA pass but get blocked for a
    // real user. Can't pass "noopener" on this synchronous open — that
    // makes window.open() return null (see window-open-noopener-gotcha),
    // and we need the handle to set .location once the URL resolves.
    const tab = window.open("", "_blank");
    startTransition(async () => {
      const result = await getReceiptUrlAction(expenseId);
      if (result.error || !result.url) {
        tab?.close();
        setError(result.error ?? "Could not open the receipt.");
        return;
      }
      if (tab) tab.location.href = result.url;
      else window.open(result.url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <span>
      <button
        type="button"
        disabled={pending}
        onClick={open}
        className="text-xs text-text-secondary underline hover:text-text disabled:opacity-50"
      >
        {pending ? "Opening…" : "View"}
      </button>
      {error && <p className="mt-1 max-w-xs text-xs text-text">{error}</p>}
    </span>
  );
}
