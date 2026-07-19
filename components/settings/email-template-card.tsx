"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Collapsible } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, FieldHint } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import { renderTemplateEmailHtml, PREVIEW_SAMPLE_VARS } from "@/lib/email-templates";

const VARIABLE_LABELS: Record<string, string> = {
  student: "Student",
  tutor: "Tutor",
  parent: "Parent",
  when: "Date",
  due_date: "Date",
  amount: "Amount",
  link: "Link",
  code: "Code",
};

const CUSTOM_VARIABLES = ["student", "tutor", "when", "amount", "due_date", "link"];

function logoUrl(): string | null {
  return typeof window !== "undefined" ? `${window.location.origin}/brand/logo/slate-logo-on-light.png` : null;
}

export function EmailTemplateCard({
  name,
  audience,
  trigger,
  variables,
  ctaLabel,
  subject: initialSubject,
  body: initialBody,
  editableName = false,
  onSave,
  onDelete,
  onRename,
  defaultOpen = false,
}: {
  name: string;
  audience: "parent" | "tutor";
  trigger: string;
  variables?: string[];
  ctaLabel?: string;
  subject: string;
  body: string;
  editableName?: boolean;
  onSave: (subject: string, body: string) => Promise<{ error?: string }>;
  onDelete?: () => Promise<{ error?: string }>;
  onRename?: (name: string) => void;
  defaultOpen?: boolean;
}) {
  const [displayName, setDisplayName] = useState(name);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [status, setStatus] = useState<{ error?: string; saved?: boolean }>({});
  const [pending, startTransition] = useTransition();
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [lastFocused, setLastFocused] = useState<"subject" | "body">("body");

  const insertVariable = (token: string) => {
    const placeholder = `{{${token}}}`;
    if (lastFocused === "subject" && subjectRef.current) {
      const el = subjectRef.current;
      const start = el.selectionStart ?? subject.length;
      const end = el.selectionEnd ?? subject.length;
      const next = subject.slice(0, start) + placeholder + subject.slice(end);
      setSubject(next);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + placeholder.length, start + placeholder.length);
      });
    } else if (bodyRef.current) {
      const el = bodyRef.current;
      const start = el.selectionStart ?? body.length;
      const end = el.selectionEnd ?? body.length;
      const next = body.slice(0, start) + placeholder + body.slice(end);
      setBody(next);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + placeholder.length, start + placeholder.length);
      });
    }
  };

  const previewHtml = useMemo(() => {
    return renderTemplateEmailHtml({ subject, body }, PREVIEW_SAMPLE_VARS, { ctaLabel, logoUrl: logoUrl() }).html;
  }, [subject, body, ctaLabel]);

  // Neither the `srcDoc` JSX prop nor imperatively setting `.srcdoc` on an
  // already-mounted iframe reliably triggers a repaint here — document.write
  // into the frame's own document does. Requires `allow-same-origin` (still
  // no `allow-scripts`, so the preview content still can't execute script;
  // this is our own generated HTML, not third-party content).
  //
  // A callback ref (not an object ref + effect) because the iframe is
  // mounted by the Collapsible below when *its own* internal open state
  // flips — that doesn't re-render this component, so an effect keyed off
  // this component's own state would never see the node appear. The
  // callback fires exactly when the DOM node attaches, whichever component
  // triggered it.
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const writePreview = (doc: Document | null | undefined) => {
    if (!doc) return;
    doc.open();
    doc.write(previewHtml);
    doc.close();
  };
  const attachPreviewFrame = (node: HTMLIFrameElement | null) => {
    previewFrameRef.current = node;
    writePreview(node?.contentDocument);
  };
  // Re-writes on every edit while the card is already open (mount-time is
  // covered by the callback ref above; this covers the node already being
  // attached when previewHtml changes).
  useEffect(() => {
    const doc = previewFrameRef.current?.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(previewHtml);
    doc.close();
  }, [previewHtml]);

  const availableVariables = variables ?? CUSTOM_VARIABLES;

  return (
    <Collapsible
      defaultOpen={defaultOpen}
      header={
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{displayName}</span>
            <Pill>{audience === "parent" ? "To parents" : "To you"}</Pill>
          </div>
          <p className="mt-0.5 truncate text-xs text-text-tertiary">{trigger}</p>
        </div>
      }
    >
      <div className="space-y-4">
        {editableName && (
          <div>
            <Label htmlFor={`name-${name}`}>Name</Label>
            <Input
              id={`name-${name}`}
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                onRename?.(e.target.value);
              }}
            />
          </div>
        )}

        <div>
          <Label htmlFor={`subject-${name}`}>Subject</Label>
          <Input
            id={`subject-${name}`}
            ref={subjectRef}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onFocus={() => setLastFocused("subject")}
          />
        </div>

        <div>
          <Label htmlFor={`body-${name}`}>Body</Label>
          <Textarea
            id={`body-${name}`}
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onFocus={() => setLastFocused("body")}
            rows={4}
          />
        </div>

        <div>
          <FieldHint className="mt-0 mb-1.5">Insert a variable at your cursor:</FieldHint>
          <div className="flex flex-wrap gap-1.5">
            {availableVariables.map((token) => (
              <button
                key={token}
                type="button"
                onClick={() => insertVariable(token)}
                className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text-secondary hover:bg-hover hover:text-text"
              >
                {VARIABLE_LABELS[token] ?? token}
              </button>
            ))}
          </div>
        </div>

        <div>
          <FieldHint className="mt-0 mb-1.5">Preview</FieldHint>
          <div className="overflow-hidden rounded-lg border border-border">
            <iframe ref={attachPreviewFrame} title={`Preview of ${displayName}`} className="h-64 w-full bg-white" sandbox="allow-same-origin" />
          </div>
        </div>

        {status.error && <p className="text-sm text-text">{status.error}</p>}
        {status.saved && <p className="text-sm text-text-secondary">Saved.</p>}

        <div className="flex gap-3">
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => {
              setStatus({});
              startTransition(async () => {
                const result = await onSave(subject, body);
                setStatus(result.error ? { error: result.error } : { saved: true });
              });
            }}
          >
            {pending ? "Saving…" : "Save"}
          </Button>
          {onDelete && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  await onDelete();
                });
              }}
            >
              Delete
            </Button>
          )}
        </div>
      </div>
    </Collapsible>
  );
}
