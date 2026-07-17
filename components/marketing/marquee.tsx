import clsx from "clsx";

const ROW_A = ["Invoices", "Travel time", "Automatic reminders", "Booking links", "Parent portal", "Session notes", "Cancellations & credits"];
const ROW_B = ["Prepaid packages", "Expenses & mileage", "Business insights", "Card payments", "Recurring sessions", "Public booking page"];

function Pill({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-border bg-surface px-4 py-2 text-sm text-text-secondary">
      <span className="mr-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
      {label}
    </span>
  );
}

function MarqueeRow({ items, reverse }: { items: string[]; reverse?: boolean }) {
  // Doubled so the 50%-translate loop is seamless. Reduced-motion visitors
  // never see the animation trigger, so the doubled content just renders
  // as a static (slightly overflowing, clipped) row — no infinite scroll,
  // no motion, still legible.
  return (
    <div className="overflow-hidden">
      <div
        className={clsx(
          "flex w-max gap-3 motion-safe:hover:[animation-play-state:paused]",
          reverse ? "motion-safe:animate-[marquee-right_40s_linear_infinite]" : "motion-safe:animate-[marquee-left_40s_linear_infinite]"
        )}
      >
        {[...items, ...items].map((label, i) => (
          <Pill key={`${label}-${i}`} label={label} />
        ))}
      </div>
    </div>
  );
}

export function CapabilityMarquee() {
  return (
    <section className="space-y-3 overflow-hidden border-t border-border py-10 sm:py-14">
      <MarqueeRow items={ROW_A} />
      <MarqueeRow items={ROW_B} reverse />
    </section>
  );
}
