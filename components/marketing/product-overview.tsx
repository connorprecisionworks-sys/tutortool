import { ReactNode } from "react";
import { Reveal } from "@/components/marketing/reveal";
import { InvoiceMockup, BookingLinkMockup, ParentPortalMockup, InsightsMockup } from "@/components/marketing/mockups";

const OVERVIEW: { title: string; body: string; mockup: ReactNode }[] = [
  {
    title: "Billing & invoices",
    body: "Draft, send, and collect, with reminders that chase late payments for you.",
    mockup: <InvoiceMockup />,
  },
  {
    title: "Scheduling & booking",
    body: "Offer times, parents pick one, it becomes a billable session automatically.",
    mockup: <BookingLinkMockup />,
  },
  {
    title: "Parent portal",
    body: "Every family gets a scoped view of sessions, notes, resources, and bills.",
    mockup: <ParentPortalMockup />,
  },
  {
    title: "Business insights",
    body: "Revenue, outstanding, and upcoming income, always current.",
    mockup: <InsightsMockup />,
  },
];

export function ProductOverview() {
  return (
    <section id="features" className="border-t border-border px-6 py-20 sm:px-10 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Everything the money side needs</p>
        </Reveal>
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {OVERVIEW.map((item, i) => (
            <Reveal key={item.title} delay={i * 80}>
              <div className="flex h-full flex-col gap-4 rounded-xl border border-border bg-surface p-5">
                {item.mockup}
                <div>
                  <h3 className="text-base tracking-tight">{item.title}</h3>
                  <p className="mt-1.5 text-sm text-text-secondary">{item.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
