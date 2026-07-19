"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { createCustomTemplateAction } from "@/app/tutor/settings/email/actions";
import type { CustomEmailTemplate } from "@/lib/email-templates";

export function NewCustomTemplateCard({
  onCreated,
  onCancel,
}: {
  onCreated: (template: CustomEmailTemplate) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card className="space-y-4">
      <div>
        <Label htmlFor="new-template-name">Name</Label>
        <Input id="new-template-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Holiday schedule note" />
      </div>
      <div>
        <Label htmlFor="new-template-subject">Subject</Label>
        <Input id="new-template-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="new-template-body">Body</Label>
        <Textarea id="new-template-body" value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
      </div>
      {error && <p className="text-sm text-text">{error}</p>}
      <div className="flex gap-3">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await createCustomTemplateAction(name, subject, body);
              if (result.error || !result.id) {
                setError(result.error ?? "Could not create the template.");
                return;
              }
              onCreated({ id: result.id, name: name.trim(), subject: subject.trim(), body: body.trim() });
            });
          }}
        >
          {pending ? "Creating…" : "Create"}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
