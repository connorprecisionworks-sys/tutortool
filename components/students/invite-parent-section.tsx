"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusDot, type StatusKind } from "@/components/ui/status-dot";
import { createInviteAction, regenerateInviteAction, revokeInviteAction } from "@/app/tutor/students/invite-actions";
import type { Tables } from "@/lib/database.types";

type Invite = Tables<"invites">;

function inviteLink(code: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/join?code=${code}`;
}

export function InviteParentSection({ studentId, invites }: { studentId: string; invites: Invite[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function generate() {
    startTransition(async () => {
      setCopied(false);
      const result = await createInviteAction(studentId);
      if (result.error) setError(result.error);
      else {
        setError(null);
        setNewCode(result.code ?? null);
        router.refresh();
      }
    });
  }

  function revoke(inviteId: string) {
    if (!confirm("Revoke this invite code? It can no longer be used to join.")) return;
    startTransition(async () => {
      const result = await revokeInviteAction(inviteId, studentId);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  function regenerate(inviteId: string) {
    if (!confirm("Regenerate this code? The old one stops working immediately.")) return;
    startTransition(async () => {
      setCopied(false);
      const result = await regenerateInviteAction(inviteId, studentId);
      if (result.error) setError(result.error);
      else {
        setError(null);
        setNewCode(result.code ?? null);
        router.refresh();
      }
    });
  }

  async function copyLink(code: string) {
    try {
      await navigator.clipboard.writeText(inviteLink(code));
      setCopied(true);
    } catch {
      // Clipboard access can be blocked; the link is still visible to select manually.
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          Generate a code and send it to a parent — they&apos;ll enter it (or click the link) to see this
          student&apos;s sessions, notes, resources, and invoices.
        </p>
        <Button variant="secondary" size="sm" disabled={pending} onClick={generate}>
          {pending ? "Generating…" : "Invite parent"}
        </Button>
      </div>

      {newCode && (
        <div className="rounded-lg border border-border bg-surface-sunken px-4 py-3 text-sm">
          <p className="font-medium">Code: {newCode}</p>
          <p className="mt-1 break-all text-xs text-text-secondary">{inviteLink(newCode)}</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => copyLink(newCode)}>
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-text">{error}</p>}

      {invites.length > 0 && (
        <table className="w-full text-sm">
          <thead className="text-left text-text-secondary">
            <tr>
              <th className="py-2 font-medium">Code</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 font-medium">Created</th>
              <th className="py-2 font-medium">Used by</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {invites.map((inv) => (
              <tr key={inv.id} className="border-t border-border">
                <td className="py-2 font-mono">{inv.code}</td>
                <td className="py-2">
                  <StatusDot status={inv.status as StatusKind} />
                </td>
                <td className="py-2 text-text-secondary">{new Date(inv.created_at).toLocaleDateString()}</td>
                <td className="py-2 text-text-secondary">
                  {inv.status === "used" ? (inv.redeemed_by_name ?? inv.redeemed_by_email ?? "—") : "—"}
                </td>
                <td className="py-2 text-right">
                  {inv.status === "open" && (
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => regenerate(inv.id)}
                        className="text-xs text-text-tertiary hover:text-text disabled:opacity-50"
                      >
                        Regenerate
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => revoke(inv.id)}
                        className="text-xs text-text-tertiary hover:text-text disabled:opacity-50"
                      >
                        Revoke
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
