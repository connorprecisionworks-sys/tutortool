"use client";

import { useState } from "react";
import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Collapsible } from "@/components/ui/collapsible";
import { useToast } from "@/components/ui/toast";
import { recordFeedbackBreadcrumb } from "@/lib/feedback/breadcrumbs";
import { buildFeedbackContext, type FeedbackContext } from "@/lib/feedback/context";
import { submitFeedbackAction, type FeedbackCategory } from "@/app/tutor/feedback/actions";

const CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: "bug", label: "Bug" },
  { value: "idea", label: "Idea" },
  { value: "confusing", label: "Confusing" },
  { value: "praise", label: "Praise" },
];

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m ago`;
}

function ContextPreview({ context }: { context: FeedbackContext }) {
  return (
    <div className="space-y-3 text-xs text-text-secondary">
      <div>
        <p className="font-medium text-text">Page</p>
        <p className="mt-0.5 font-mono">{context.route}</p>
      </div>
      <div>
        <p className="font-medium text-text">Recent actions</p>
        {context.breadcrumb.length === 0 ? (
          <p className="mt-0.5 text-text-tertiary">None yet this session.</p>
        ) : (
          <ul className="mt-0.5 space-y-0.5">
            {context.breadcrumb.map((b, i) => (
              <li key={i} className="font-mono">
                {b.type === "navigate" ? "navigated" : "clicked"} {b.label}{" "}
                <span className="text-text-tertiary">· {timeAgo(b.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="font-medium text-text">Device</p>
        <p className="mt-0.5">
          {context.device.viewport.width}×{context.device.viewport.height} · {context.device.theme} mode
        </p>
      </div>
      <div>
        <p className="font-medium text-text">Recent errors</p>
        {context.console_errors.length === 0 ? (
          <p className="mt-0.5 text-text-tertiary">None.</p>
        ) : (
          <ul className="mt-0.5 space-y-0.5">
            {context.console_errors.map((e, i) => (
              <li key={i} className="font-mono">
                {e.message}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-text-tertiary">
        App version {context.app_version} · Never includes form text, notes, or student/parent details.
      </p>
    </div>
  );
}

export function FeedbackWidget() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<FeedbackContext | null>(null);
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function openWidget() {
    recordFeedbackBreadcrumb("click", "Opened feedback");
    setContext(buildFeedbackContext());
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setBody("");
    setCategory(null);
    setError(null);
    setSent(false);
  }

  async function send() {
    if (!body.trim() || !context) return;
    setSending(true);
    setError(null);
    const result = await submitFeedbackAction({ body, category, context });
    setSending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSent(true);
    toast("Thanks — feedback sent.", { variant: "success" });
    setTimeout(close, 1100);
  }

  return (
    <>
      <button
        type="button"
        onClick={openWidget}
        className="w-full rounded-lg px-3 py-2 text-left text-sm text-text-secondary hover:bg-hover hover:text-text"
      >
        Feedback
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/30 px-4 pb-4 sm:items-center sm:pb-0"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Send feedback"
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-surface motion-safe:animate-[fade-rise-in_150ms_ease-out]"
          >
            {sent ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm font-medium text-text">Thanks — got it.</p>
                <p className="mt-1 text-xs text-text-secondary">We read every message.</p>
              </div>
            ) : (
              // max-h + overflow-y-auto: on a short mobile viewport, an
              // expanded "What's included" preview with a full breadcrumb
              // trail can be taller than the screen — without a scroll
              // boundary here, the fixed inset-0 overlay silently clips
              // the excess with no way to reach it (found via 390px QA,
              // build-queue.md F1).
              <div className="max-h-[85vh] overflow-y-auto p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Send feedback</h2>
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Close"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-text-tertiary hover:bg-hover hover:text-text"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <Textarea
                  autoFocus
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="What's on your mind? A bug, an idea, anything confusing…"
                  maxLength={4000}
                  className="mt-3 min-h-28"
                />

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCategory((cur) => (cur === c.value ? null : c.value))}
                      className={clsx(
                        "rounded-full border px-3 py-1 text-xs",
                        category === c.value
                          ? "border-border-strong bg-hover text-text"
                          : "border-border text-text-secondary hover:bg-hover hover:text-text"
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                {context && (
                  <Collapsible header={<span className="text-xs font-medium text-text">What&apos;s included</span>} className="mt-3">
                    <ContextPreview context={context} />
                  </Collapsible>
                )}

                {error && <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>}

                <div className="mt-4 flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={close}>
                    Cancel
                  </Button>
                  <Button type="button" size="sm" onClick={send} disabled={sending || !body.trim()}>
                    {sending ? "Sending…" : "Send"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
