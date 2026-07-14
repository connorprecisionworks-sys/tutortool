"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import {
  markInvoicePaidAction,
  regeneratePaymentLinkAction,
  sendInvoiceAction,
  voidInvoiceAction,
} from "@/app/tutor/invoices/actions";

export function SendInvoiceButton({ invoiceId, disabled }: { invoiceId: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        disabled={disabled || pending}
        onClick={() =>
          startTransition(async () => {
            const result = await sendInvoiceAction(invoiceId);
            if (result.error) setError(result.error);
            else router.refresh();
          })
        }
      >
        {pending ? "Sending…" : "Send invoice"}
      </Button>
      {error && <p className="mt-2 text-sm text-text">{error}</p>}
    </div>
  );
}

export function MarkPaidControl({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [method, setMethod] = useState("venmo");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={method} onChange={(e) => setMethod(e.target.value)} className="w-auto">
        <option value="venmo">Venmo</option>
        <option value="zelle">Zelle</option>
        <option value="cash">Cash</option>
        <option value="other">Other</option>
      </Select>
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await markInvoicePaidAction(invoiceId, method);
            if (result.error) setError(result.error);
            else router.refresh();
          })
        }
      >
        {pending ? "Marking paid…" : "Mark as paid"}
      </Button>
      {error && <p className="w-full text-sm text-text">{error}</p>}
    </div>
  );
}

export function RegeneratePaymentLinkButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await regeneratePaymentLinkAction(invoiceId);
            if (result.error) setError(result.error);
            else router.refresh();
          })
        }
      >
        {pending ? "Generating…" : "Generate/refresh payment link"}
      </Button>
      {error && <p className="mt-1 text-xs text-text">{error}</p>}
    </div>
  );
}

export function VoidInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() => {
          if (!confirm("Void this invoice? Its sessions become unbilled again.")) return;
          startTransition(async () => {
            const result = await voidInvoiceAction(invoiceId);
            if (result.error) setError(result.error);
            else router.refresh();
          });
        }}
      >
        {pending ? "Voiding…" : "Void"}
      </Button>
      {error && <p className="mt-2 text-sm text-text">{error}</p>}
    </div>
  );
}
