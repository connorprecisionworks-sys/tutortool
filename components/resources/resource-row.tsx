"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OpenResourceButton } from "@/components/resources/open-resource-button";
import { DeleteResourceButton } from "@/components/resources/delete-resource-button";
import { formatCents } from "@/lib/money";
import {
  updateResourceAction,
  setResourceGateAction,
  removeResourceGateAction,
  manuallyUnlockResourceGateAction,
  type ResourceFormResult,
} from "@/app/tutor/resources/actions";

const initialState: ResourceFormResult = {};

interface Gate {
  id: string;
  price_cents: number;
  status: string;
  unlock_invoice_id: string | null;
}

export function ResourceRow({
  id,
  title,
  studentName,
  type,
  urlOrPath,
  gate,
}: {
  id: string;
  title: string;
  studentName: string;
  type: string;
  urlOrPath: string;
  gate: Gate | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [gating, setGating] = useState(false);
  const [state, formAction, pending] = useActionState(async (prev: ResourceFormResult, formData: FormData) => {
    const result = await updateResourceAction(prev, formData);
    if (!result.error) {
      setEditing(false);
      router.refresh();
    }
    return result;
  }, initialState);

  if (editing) {
    return (
      <tr className="border-t border-border bg-surface-sunken">
        <td className="px-5 py-3" colSpan={5}>
          <form action={formAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={id} />
            <div className="min-w-[180px] flex-1">
              <Input name="title" defaultValue={title} required placeholder="Title" />
            </div>
            {type === "link" && (
              <div className="min-w-[240px] flex-1">
                <Input name="url" type="url" defaultValue={urlOrPath} required placeholder="https://…" />
              </div>
            )}
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </form>
          {state.error && <p className="mt-2 text-sm text-text">{state.error}</p>}
        </td>
      </tr>
    );
  }

  if (gating) {
    return (
      <tr className="border-t border-border bg-surface-sunken">
        <td className="px-5 py-3" colSpan={5}>
          <GateForm resourceId={id} gate={gate} onDone={() => setGating(false)} />
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-border">
      <td className="px-5 py-3 font-medium">{title}</td>
      <td className="px-5 py-3 text-text-secondary">{studentName}</td>
      <td className="px-5 py-3 text-text-secondary capitalize">{type}</td>
      <td className="px-5 py-3">
        {gate ? (
          <div className="flex items-center gap-2">
            <span className="tabular-nums">{formatCents(gate.price_cents)}</span>
            <span
              className={`inline-flex items-center gap-1 text-xs ${gate.status === "unlocked" ? "text-text" : "text-text-tertiary"}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${gate.status === "unlocked" ? "bg-accent" : "bg-border-strong"}`} />
              {gate.status === "unlocked" ? "Unlocked" : gate.unlock_invoice_id ? "On invoice" : "Locked"}
            </span>
          </div>
        ) : (
          <span className="text-text-tertiary">—</span>
        )}
      </td>
      <td className="px-5 py-3 text-right">
        <div className="flex items-center justify-end gap-3">
          <OpenResourceButton resourceId={id} label="Open" />
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-text-tertiary hover:text-text"
          >
            Edit
          </button>
          <button type="button" onClick={() => setGating(true)} className="text-xs text-text-tertiary hover:text-text">
            {gate ? "Price" : "Add price"}
          </button>
          <DeleteResourceButton resourceId={id} />
        </div>
      </td>
    </tr>
  );
}

function GateForm({ resourceId, gate, onDone }: { resourceId: string; gate: Gate | null; onDone: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, formAction, formPending] = useActionState(async (prev: ResourceFormResult, formData: FormData) => {
    const result = await setResourceGateAction(prev, formData);
    if (!result.error) {
      router.refresh();
      onDone();
    }
    return result;
  }, initialState);

  const locked = !gate || (gate.status === "locked" && !gate.unlock_invoice_id);

  return (
    <div className="space-y-2">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="resource_id" value={resourceId} />
        <div className="w-32">
          <Input
            name="price"
            type="number"
            step="0.01"
            min="0.01"
            defaultValue={gate ? (gate.price_cents / 100).toFixed(2) : ""}
            placeholder="Price $"
            disabled={!locked}
            required
          />
        </div>
        {locked && (
          <Button type="submit" size="sm" disabled={formPending}>
            {formPending ? "Saving…" : gate ? "Update price" : "Gate this resource"}
          </Button>
        )}
        {gate && gate.status === "locked" && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await manuallyUnlockResourceGateAction(gate.id);
                router.refresh();
                onDone();
              })
            }
          >
            {pending ? "Unlocking…" : "Unlock now (comp)"}
          </Button>
        )}
        {locked && gate && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await removeResourceGateAction(resourceId);
                router.refresh();
                onDone();
              })
            }
          >
            {pending ? "Removing…" : "Remove gate"}
          </Button>
        )}
        <Button type="button" variant="secondary" size="sm" onClick={onDone}>
          Close
        </Button>
      </form>
      {!locked && (
        <p className="text-xs text-text-tertiary">
          This resource is already on an invoice or unlocked — remove it from the invoice first to change the
          price.
        </p>
      )}
      {state.error && <p className="text-sm text-text">{state.error}</p>}
    </div>
  );
}
