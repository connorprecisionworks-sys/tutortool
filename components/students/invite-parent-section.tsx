"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Input, Label } from "@/components/ui/input";
import { buildInviteMessage } from "@/lib/invite-message";
import {
  logInviteCopyAction,
  regenerateInviteAction,
  revokeInviteAction,
  sendInviteEmailAction,
} from "@/app/tutor/students/invite-actions";
import type { Tables } from "@/lib/database.types";

type Invite = Tables<"invites">;
type Redemption = Pick<Tables<"parent_students">, "id" | "parent_name" | "parent_email" | "created_at">;
type PendingInvite = Pick<Tables<"invite_sends">, "id" | "parent_name" | "parent_email" | "sent_at">;

// Deliberately not lib/date.ts's formatTimestampDate (UTC-pinned, chosen so
// Server Component pages render deterministically regardless of the host's
// timezone). This is a "use client" component, so a plain unpinned
// toLocaleDateString() risks a one-frame hydration mismatch if the SSR pass
// runs in a different zone than the browser — accepted here in exchange for
// showing the tutor's own actual local join/invite date afterward, rather
// than a UTC date that's silently a day off for anyone west of it. This is a
// secondary list (parent joins/invites), not a money or privacy surface, so
// the tradeoff favors accuracy for the viewer over hydration purity.
function formatLocalDate(isoTimestamp: string): string {
  // "en-US" pins the M/D/Y ordering (this app's date-format standard,
  // D4) — omitting it would format using the browser's own locale
  // (e.g. DD/MM/YYYY in most of Europe). Timezone is deliberately left
  // unpinned (see comment above) so only the day-order is fixed, not
  // which calendar day it resolves to.
  return new Date(isoTimestamp).toLocaleDateString("en-US");
}

export function InviteParentSection({
  studentId,
  studentName,
  currentInvite,
  joinLink,
  qrSvg,
  emailConfigured,
  redemptions,
  pendingInvites,
}: {
  studentId: string;
  studentName: string;
  currentInvite: Invite | null;
  joinLink: string | null;
  qrSvg: string | null;
  emailConfigured: boolean;
  redemptions: Redemption[];
  pendingInvites: PendingInvite[];
}) {
  const router = useRouter();
  const [codePending, startCodeTransition] = useTransition();
  const [copyLogPending, startCopyLogTransition] = useTransition();
  const [sendPending, startSendTransition] = useTransition();
  const [codeError, setCodeError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");

  const active = currentInvite?.status === "active";
  const message =
    active && currentInvite && joinLink
      ? buildInviteMessage({ studentName, parentName, link: joinLink, code: currentInvite.code })
      : "";

  function revoke() {
    if (!confirm("Revoke this Student Code? No new parents will be able to join with it.")) return;
    startCodeTransition(async () => {
      const result = await revokeInviteAction(studentId);
      if (result.error) setCodeError(result.error);
      else {
        setCodeError(null);
        router.refresh();
      }
    });
  }

  function regenerate() {
    const confirmMessage = active
      ? "Regenerate the Student Code? The current code stops working immediately — parents already linked stay linked."
      : "Generate a new Student Code for this student?";
    if (!confirm(confirmMessage)) return;
    startCodeTransition(async () => {
      const result = await regenerateInviteAction(studentId);
      if (result.error) setCodeError(result.error);
      else {
        setCodeError(null);
        router.refresh();
      }
    });
  }

  function handleMessageCopied() {
    if (!parentEmail.trim()) return;
    startCopyLogTransition(async () => {
      await logInviteCopyAction(studentId, parentName, parentEmail);
      router.refresh();
    });
  }

  function sendEmailInvite() {
    setSendError(null);
    setSendSuccess(null);
    startSendTransition(async () => {
      const result = await sendInviteEmailAction(studentId, parentName, parentEmail);
      if (result.error) setSendError(result.error);
      else {
        setSendSuccess(`Sent to ${parentEmail.trim()}.`);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {active && currentInvite && joinLink ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="parent_name">Parent name (optional)</Label>
                <Input
                  id="parent_name"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <Label htmlFor="parent_email">Parent email (optional)</Label>
                <Input
                  id="parent_email"
                  type="email"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  placeholder="jane@example.com"
                />
              </div>
            </div>

            <div>
              <Label>Invitation message</Label>
              <p className="rounded-lg border border-border bg-surface-sunken px-3 py-2.5 text-sm text-text-secondary">
                {message}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <CopyButton
                value={message}
                label="Copy message"
                copiedLabel="Copied"
                variant="primary"
                onCopied={handleMessageCopied}
              />
              <CopyButton value={joinLink} label="Copy link" variant="secondary" />
              <CopyButton value={currentInvite.code} label="Copy code" variant="secondary" />
              {copyLogPending && <span className="text-xs text-text-tertiary">Saving…</span>}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              {emailConfigured ? (
                <Button variant="secondary" size="sm" disabled={sendPending || !parentEmail.trim()} onClick={sendEmailInvite}>
                  {sendPending ? "Sending…" : "Send email invite"}
                </Button>
              ) : (
                <span title="Add RESEND_API_KEY to enable email invites">
                  <Button variant="secondary" size="sm" disabled>
                    Send email invite
                  </Button>
                </span>
              )}
              {sendSuccess && <span className="text-xs text-text-secondary">{sendSuccess}</span>}
              {sendError && <span className="text-xs text-text">{sendError}</span>}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-center gap-2 lg:items-end">
            {qrSvg && (
              <div
                className="h-32 w-32 rounded-lg border border-border bg-surface-sunken p-2 [&_svg]:h-full [&_svg]:w-full"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            )}
            <p className="text-xs text-text-tertiary">Scan to join</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-text-secondary">
          {currentInvite
            ? "This student's code is revoked — generate a new one to invite a parent."
            : "No code yet — generate one to invite a parent."}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <Button variant="ghost" size="sm" disabled={codePending} onClick={regenerate}>
          {codePending ? "Working…" : active ? "Regenerate code" : "Generate code"}
        </Button>
        {active && (
          <Button variant="ghost" size="sm" disabled={codePending} onClick={revoke}>
            Revoke
          </Button>
        )}
        {codeError && <span className="text-sm text-text">{codeError}</span>}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium">
            Joined{redemptions.length > 0 ? ` (${redemptions.length})` : ""}
          </p>
          {redemptions.length === 0 ? (
            <p className="text-sm text-text-secondary">No parent has joined yet.</p>
          ) : (
            <ul className="space-y-2">
              {redemptions.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{r.parent_name || r.parent_email}</span>
                  <span className="shrink-0 text-text-tertiary">{formatLocalDate(r.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">
            Pending{pendingInvites.length > 0 ? ` (${pendingInvites.length})` : ""}
          </p>
          {pendingInvites.length === 0 ? (
            <p className="text-sm text-text-secondary">No pending invites.</p>
          ) : (
            <ul className="space-y-2">
              {pendingInvites.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{p.parent_name || p.parent_email}</span>
                  <span className="shrink-0 text-text-tertiary">{formatLocalDate(p.sent_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
