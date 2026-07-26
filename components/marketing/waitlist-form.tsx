"use client";

import { useActionState, useState } from "react";
import clsx from "clsx";
import { joinWaitlistAction, submitWaitlistSurveyAction, type WaitlistActionResult } from "@/app/actions";

const EMPTY: WaitlistActionResult = {};

/**
 * Two-step waitlist capture, styled for the landing page's dark bands (the
 * hero and closing CTA are near-black in BOTH themes, matching the campaign
 * ad, so colors here are deliberately fixed rather than token-driven —
 * tokens would invert the text into illegibility in light mode).
 *
 * Step 1: email only — zero friction. Step 2 (optional, revealed on
 * success): two short survey questions that feed our launch stats. Skippable;
 * the visitor is already on the list either way.
 */
export function WaitlistForm({ id, source }: { id: string; source: string }) {
  const [joinState, joinAction, joinPending] = useActionState(joinWaitlistAction, EMPTY);
  const [surveyState, surveyAction, surveyPending] = useActionState(submitWaitlistSurveyAction, EMPTY);
  const [surveySkipped, setSurveySkipped] = useState(false);

  const joined = Boolean(joinState.email);
  const surveyDone = Boolean(surveyState.email) || surveySkipped;

  const fieldClasses =
    "h-12 w-full rounded-lg border border-[#2a2a2a] bg-[#202020] px-4 text-sm text-[#f7f7f7] placeholder:text-[#7a8699] focus:outline-none focus:border-[#5f728c] focus:ring-4 focus:ring-[rgba(95,114,140,0.35)] transition duration-150";

  if (joined) {
    return (
      <div
        aria-live="polite"
        className="w-full max-w-md motion-safe:animate-[fade-rise-in_0.5s_ease-out_both]"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5f728c]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f7f7f7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <p className="text-base font-medium text-[#f7f7f7]">
            You&apos;re on the list — we&apos;ll be in touch.
          </p>
        </div>

        {surveyDone ? (
          <p className="mt-4 text-sm text-[#a8b8cc] motion-safe:animate-[fade-rise-in_0.4s_ease-out_both]">
            {surveyState.email ? "Thanks — that helps us build the right thing." : "See you at launch."}
          </p>
        ) : (
          <form action={surveyAction} className="mt-6 motion-safe:animate-[fade-rise-in_0.5s_ease-out_0.15s_both]">
            <p className="text-sm text-[#a8b8cc]">While you&apos;re here — 20 seconds, big help:</p>
            <input type="hidden" name="email" value={joinState.email} />
            <div className="mt-3 flex flex-col gap-3">
              <label className="sr-only" htmlFor={`${id}-subjects`}>
                What do you tutor?
              </label>
              <input
                id={`${id}-subjects`}
                name="subjects"
                type="text"
                maxLength={200}
                placeholder="What do you tutor? (e.g. math, SAT prep)"
                className={fieldClasses}
              />
              <label className="sr-only" htmlFor={`${id}-students`}>
                How many students do you work with?
              </label>
              <select id={`${id}-students`} name="num_students" defaultValue="" className={clsx(fieldClasses, "appearance-none pr-8")}>
                <option value="" disabled>
                  How many students right now?
                </option>
                <option value="1-2">1–2</option>
                <option value="3-5">3–5</option>
                <option value="6-10">6–10</option>
                <option value="10+">More than 10</option>
              </select>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="submit"
                disabled={surveyPending}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-[#5f728c] px-5 text-sm font-medium text-white transition duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(95,114,140,0.35)] disabled:pointer-events-none disabled:opacity-50 motion-safe:hover:-translate-y-0.5"
              >
                {surveyPending ? "Sending…" : "Send"}
              </button>
              <button
                type="button"
                onClick={() => setSurveySkipped(true)}
                className="h-11 rounded-lg px-3 text-sm text-[#a8b8cc] transition duration-150 hover:text-[#f7f7f7] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(95,114,140,0.35)]"
              >
                Skip
              </button>
            </div>
            {surveyState.error && (
              <p role="alert" className="mt-2 text-sm text-[#a8b8cc]">
                {surveyState.error}
              </p>
            )}
          </form>
        )}
      </div>
    );
  }

  return (
    <form action={joinAction} className="w-full max-w-md">
      <input type="hidden" name="source" value={source} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor={id}>
          Email address
        </label>
        <input
          id={id}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className={fieldClasses}
        />
        <button
          type="submit"
          disabled={joinPending}
          className="inline-flex h-12 shrink-0 items-center justify-center rounded-lg bg-[#5f728c] px-6 text-sm font-semibold text-white transition duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(95,114,140,0.35)] disabled:pointer-events-none disabled:opacity-50 motion-safe:hover:-translate-y-0.5"
        >
          {joinPending ? "Joining…" : "Join the waitlist"}
        </button>
      </div>
      <div aria-live="polite">
        {joinState.error && (
          <p role="alert" className="mt-2 text-sm text-[#a8b8cc]">
            {joinState.error}
          </p>
        )}
      </div>
      <p className="mt-3 text-xs text-[#7a8699]">Free early access · No card required · Built for tutors</p>
    </form>
  );
}
