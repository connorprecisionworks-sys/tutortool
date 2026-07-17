import { ReactNode } from "react";
import { Reveal } from "@/components/marketing/reveal";
import { RatesMockup, SessionLogMockup, InvoiceMockup } from "@/components/marketing/mockups";

const STEPS: { title: string; body: string; mockup: ReactNode }[] = [
  {
    title: "Set your rates and services.",
    body: "Per-family rates, packages, and service pricing, your call.",
    mockup: <RatesMockup />,
  },
  {
    title: "Log sessions, or let parents book with a link.",
    body: "Teach, then log it, or send a link and let it fill your calendar.",
    mockup: <SessionLogMockup />,
  },
  {
    title: "Send invoices and get paid.",
    body: "Slate handles reminders, cancellations, and the rest.",
    mockup: <InvoiceMockup />,
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-border px-6 py-20 sm:px-10 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">How it works</p>
        </Reveal>
        <div className="mt-10 grid grid-cols-1 gap-10 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <Reveal key={step.title} delay={i * 100}>
              <div>
                <span className="tabular-nums text-sm font-semibold text-accent">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-3 text-base tracking-tight">{step.title}</h3>
                <p className="mt-2 text-sm text-text-secondary">{step.body}</p>
                <div className="mt-4">{step.mockup}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
