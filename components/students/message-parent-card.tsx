"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea, FieldHint } from "@/components/ui/input";
import { sendAdHocMessageAction, type MessageFormResult } from "@/app/tutor/students/message-actions";

const initialState: MessageFormResult = {};

export function MessageParentCard({
  clientId,
  payerEmail,
  resendConfigured,
}: {
  clientId: string;
  payerEmail: string | null;
  resendConfigured: boolean;
}) {
  const [state, formAction, pending] = useActionState(sendAdHocMessageAction, initialState);

  return (
    <Card className="max-w-2xl">
      <h2 className="mb-1 text-sm font-semibold">Send a message</h2>
      <p className="mb-4 text-xs text-text-tertiary">
        A one-off email to the payer on file — not a template, just a direct note.
      </p>

      {!payerEmail ? (
        <p className="text-sm text-text-secondary">Add a payer email on this student to send a message.</p>
      ) : (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="client_id" value={clientId} />
          <div>
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" name="subject" required placeholder="e.g. Rescheduling this week's session" />
          </div>
          <div>
            <Label htmlFor="body">Message</Label>
            <Textarea id="body" name="body" rows={5} required />
          </div>
          {!resendConfigured && (
            <FieldHint>Resend isn&apos;t configured yet — this will be logged, not delivered, until it is.</FieldHint>
          )}
          {state.error && <p className="text-sm text-text">{state.error}</p>}
          {state.sent && !state.error && <p className="text-sm text-text-secondary">Sent to {payerEmail}.</p>}
          <Button type="submit" variant="secondary" size="sm" disabled={pending}>
            {pending ? "Sending…" : "Send"}
          </Button>
        </form>
      )}
    </Card>
  );
}
