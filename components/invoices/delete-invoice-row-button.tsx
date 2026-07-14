"use client";

import { useRouter } from "next/navigation";
import { deleteDraftInvoiceAction } from "@/app/tutor/invoices/actions";
import { useConfirmedAction } from "@/lib/hooks/use-confirmed-action";

export function DeleteInvoiceRowButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const { run, pending, error } = useConfirmedAction(
    deleteDraftInvoiceAction,
    "Delete this draft invoice? This can't be undone.",
    () => router.refresh()
  );

  return (
    <span>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(invoiceId)}
        className="text-xs text-text-tertiary hover:text-text disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error && <p className="mt-1 max-w-xs text-xs text-text">{error}</p>}
    </span>
  );
}
