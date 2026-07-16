"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { StatusDot, type StatusKind } from "@/components/ui/status-dot";
import { studentJoinLink } from "@/lib/invite-link";
import { regenerateInviteAction, revokeInviteAction } from "@/app/tutor/students/invite-actions";
import type { Tables } from "@/lib/database.types";

type Invite = Tables<"invites">;
type Redemption = Pick<Tables<"parent_students">, "id" | "parent_name" | "parent_email" | "created_at">;

export function InviteParentSection({
  studentId,
  currentInvite,
  redemptions,
}: {
  studentId: string;
  currentInvite: Invite | null;
  redemptions: Redemption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const active = currentInvite?.status === "active";

  function revoke() {
    if (!confirm("Revoke this Student Code? No new parents will be able to join with it.")) return;
    startTransition(async () => {
      const result = await revokeInviteAction(studentId);
      if (result.error) setError(result.error);
      else {
        setError(null);
        router.refresh();
      }
    });
  }

  function regenerate() {
    const message = active
      ? "Regenerate the Student Code? The current code stops working immediately — parents already linked stay linked."
      : "Generate a new Student Code for this student?";
    if (!confirm(message)) return;
    startTransition(async () => {
      const result = await regenerateInviteAction(studentId);
      if (result.error) setError(result.error);
      else {
        setError(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">
        Share this Student Code (or the join link) with a parent — they can enter it to see this student&apos;s
        sessions, notes, resources, and invoices. The same code works for more than one guardian.
      </p>

      <div className="rounded-lg border border-border bg-surface-sunken px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-text-tertiary">Student Code</span>
          <StatusDot status={(currentInvite?.status ?? "revoked") as StatusKind} />
        </div>

        {currentInvite ? (
          <>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="font-mono text-lg tracking-widest">{currentInvite.code}</span>
              {active && <CopyButton value={currentInvite.code} label="Copy code" copiedLabel="Copied" />}
            </div>

            {active && (
              <div className="mt-3">
                <p className="mb-1 text-xs text-text-tertiary">Join link</p>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="break-all text-xs text-text-secondary">{studentJoinLink(currentInvite.code)}</p>
                  <CopyButton value={studentJoinLink(currentInvite.code)} label="Copy link" copiedLabel="Copied" />
                </div>
              </div>
            )}

            {!active && (
              <p className="mt-2 text-sm text-text-secondary">
                This code is revoked and no longer accepts new redemptions. Regenerate to issue a new one —
                parents already linked keep their access.
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-text-secondary">No code yet.</p>
        )}

        <div className="mt-3 flex gap-3">
          <Button variant="secondary" size="sm" disabled={pending} onClick={regenerate}>
            {pending ? "Working…" : "Regenerate code"}
          </Button>
          {active && (
            <Button variant="ghost" size="sm" disabled={pending} onClick={revoke}>
              Revoke
            </Button>
          )}
        </div>

        {error && <p className="mt-2 text-sm text-text">{error}</p>}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">
          Linked guardians{redemptions.length > 0 ? ` (${redemptions.length})` : ""}
        </p>
        {redemptions.length === 0 ? (
          <p className="text-sm text-text-secondary">No parent has joined with this student&apos;s code yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-text-secondary">
              <tr>
                <th className="py-2 font-medium">Name</th>
                <th className="py-2 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {redemptions.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-2">{r.parent_name || r.parent_email}</td>
                  <td className="py-2 text-text-secondary">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
