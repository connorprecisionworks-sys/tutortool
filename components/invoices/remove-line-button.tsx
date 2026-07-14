"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeLineItemAction } from "@/app/tutor/invoices/actions";

export function RemoveLineButton({ lineItemId, invoiceId }: { lineItemId: string; invoiceId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await removeLineItemAction(lineItemId, invoiceId);
            if (result.error) setError(result.error);
            else router.refresh();
          })
        }
        className="text-xs text-text-tertiary hover:text-text disabled:opacity-50"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {error && <p className="mt-1 text-xs text-text">{error}</p>}
    </div>
  );
}
