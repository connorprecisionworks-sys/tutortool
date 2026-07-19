"use client";

import Link from "next/link";
import clsx from "clsx";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDismissible } from "@/lib/hooks/use-dismissible";
import type { OnboardingStatus } from "@/lib/onboarding";

export function OnboardingChecklist({
  tutorId,
  status,
  className,
}: {
  tutorId: string;
  status: OnboardingStatus;
  className?: string;
}) {
  const { dismissed, dismiss } = useDismissible(`slate:onboarding-dismissed:${tutorId}`);

  const remaining = status.steps.filter((s) => !s.done);
  if (dismissed || remaining.length === 0) return null;

  // Once the C1 wizard's required steps are all satisfied, the only thing
  // left to remind about is whatever was explicitly skipped there (student,
  // Stripe) — a small persistent nudge, not the full "get set up" checklist
  // with its progress bar over required steps that are already 100% done.
  if (status.allRequiredDone) {
    return (
      <Card className={clsx("relative", className)}>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss reminder"
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-lg text-text-tertiary hover:bg-hover hover:text-text"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <h2 className="pr-8 text-sm font-semibold">A couple of optional steps left</h2>
        <ul className="mt-3 divide-y divide-border">
          {remaining.map((step) => (
            <li key={step.key} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <div>
                <p className="text-sm font-medium">{step.label}</p>
                <p className="text-xs text-text-tertiary">{step.description}</p>
              </div>
              <Link href={step.href} className="shrink-0">
                <Button variant="secondary" size="sm">
                  {step.cta}
                </Button>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  const required = status.steps.filter((s) => !s.optional);
  const optional = status.steps.filter((s) => s.optional);
  const activeKey = status.steps.find((s) => !s.done)?.key;
  const progressPct = Math.round((status.requiredDone / status.requiredTotal) * 100);

  return (
    <Card className={clsx("relative", className)}>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss checklist"
        className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-lg text-text-tertiary hover:bg-hover hover:text-text"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>

      <h2 className="pr-8 text-sm font-semibold">Get set up</h2>
      <p className="mt-1 text-sm text-text-secondary">
        A few quick steps to get you invoice-ready. Jump to any of them in any order.
      </p>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="whitespace-nowrap text-xs tabular-nums text-text-secondary">
          {status.requiredDone} of {status.requiredTotal} done
        </span>
      </div>

      <ul className="mt-5 divide-y divide-border">
        {[...required, ...optional].map((step) => {
          const isActive = step.key === activeKey;
          return (
            <li key={step.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex items-start gap-3">
                <span
                  className={clsx(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                    step.done
                      ? "border-text bg-text text-bg"
                      : isActive
                        ? "border-accent bg-accent text-accent-text"
                        : "border-border-strong text-transparent"
                  )}
                >
                  {step.done && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </span>
                <div>
                  <p className={clsx("text-sm font-medium", step.done && "text-text-secondary line-through")}>
                    {step.label}
                    {step.optional && (
                      <span className="ml-2 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-text-tertiary">
                        Optional
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-text-tertiary">{step.description}</p>
                </div>
              </div>

              {!step.done && (
                <Link href={step.href} className="shrink-0">
                  <Button variant={isActive ? "primary" : "secondary"} size="sm">
                    {step.cta}
                  </Button>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
