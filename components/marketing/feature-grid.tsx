import { ReactNode } from "react";
import clsx from "clsx";
import { Reveal } from "@/components/marketing/reveal";
import {
  BookingLinkMockup,
  CancellationMockup,
  PackageMockup,
  ExpenseMockup,
  ParentPortalMockup,
  InsightsMockup,
} from "@/components/marketing/mockups";

const FEATURES: { title: string; body: string; mockup: ReactNode }[] = [
  {
    title: "Send a link, they book.",
    body: "Offer times, parents pick, it becomes a billable session. No back-and-forth.",
    mockup: <BookingLinkMockup />,
  },
  {
    title: "Cancellations, handled.",
    body: "Roll over to a credit or refund in a tap, on your policy.",
    mockup: <CancellationMockup />,
  },
  {
    title: "Prepay and packages.",
    body: "Sell a block of sessions, draw them down automatically.",
    mockup: <PackageMockup />,
  },
  {
    title: "Taxes, minus the shoebox.",
    body: "Capture receipts, log mileage, export a year-end summary.",
    mockup: <ExpenseMockup />,
  },
  {
    title: "A portal for every parent.",
    body: "Notes, schedule, resources, and bills, scoped to their child.",
    mockup: <ParentPortalMockup />,
  },
  {
    title: "Know your numbers.",
    body: "Revenue, outstanding, and upcoming income at a glance.",
    mockup: <InsightsMockup />,
  },
];

export function FeatureGrid() {
  return (
    <section className="border-t border-border px-6 py-20 sm:px-10 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Built for how tutors actually work</p>
        </Reveal>
        <div className="mt-14 space-y-20">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.title} variant={i % 2 === 1 ? "right" : "left"}>
              <div
                className={clsx(
                  "grid grid-cols-1 items-center gap-8 sm:grid-cols-2 sm:gap-12",
                  i % 2 === 1 && "sm:[&>*:first-child]:order-2"
                )}
              >
                <div>
                  <h3 className="text-2xl tracking-tight sm:text-3xl">{feature.title}</h3>
                  <p className="mt-3 max-w-md text-base text-text-secondary">{feature.body}</p>
                </div>
                <div>{feature.mockup}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
