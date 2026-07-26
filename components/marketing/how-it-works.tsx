import { Reveal } from "@/components/marketing/reveal";

const STEPS = [
  {
    n: "01",
    title: "Log the session",
    line: "One tap after you teach. Slate already knows your rate, so the session prices itself.",
  },
  {
    n: "02",
    title: "Slate invoices it",
    line: "A clean, professional invoice goes to the parent — built, sent, and followed up on for you.",
  },
  {
    n: "03",
    title: "You get paid",
    line: "Parents pay by card. You watch it land. No chasing, no “did the transfer go through?”",
  },
];

/**
 * Steps reveal left-to-right on a longer stagger, connected by a pipeline
 * line with energy flowing along it — the page's automation motif.
 */
export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative scroll-mt-24 overflow-hidden px-6 py-20 sm:px-10 sm:py-28">
      {/* hairline dividers, fading at the edges */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(168,184,204,0.16)] to-transparent" />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-12%] top-[20%] h-[420px] w-[520px] rounded-full opacity-50 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(95,114,140,0.12), transparent 70%)" }}
      />
      <div className="relative mx-auto max-w-6xl">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#7a8699]">How it works</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-[-0.02em] text-[#f7f7f7] sm:text-4xl">
            From taught to paid,{" "}
            <span className="bg-gradient-to-r from-[#8fa6c4] to-[#5f728c] bg-clip-text text-transparent">
              in three steps.
            </span>
          </h2>
        </Reveal>

        <div className="relative mt-14 grid gap-12 sm:grid-cols-3 sm:gap-8">
          {/* the pipeline: energy flows through it continuously */}
          <svg
            aria-hidden
            className="absolute left-0 right-0 top-6 hidden h-px w-full sm:block"
            preserveAspectRatio="none"
            viewBox="0 0 100 1"
          >
            <line x1="0" y1="0.5" x2="100" y2="0.5" stroke="rgba(168,184,204,0.18)" strokeWidth="1" />
            <line
              x1="0"
              y1="0.5"
              x2="100"
              y2="0.5"
              stroke="#5f728c"
              strokeWidth="1"
              strokeDasharray="6 22"
              className="motion-safe:animate-[dash-flow_1.6s_linear_infinite]"
              style={{ filter: "drop-shadow(0 0 4px rgba(95,114,140,0.9))" }}
            />
          </svg>

          {STEPS.map((step, i) => (
            <Reveal key={step.n} delay={i * 180}>
              <div className="relative">
                <span className="relative inline-flex h-12 items-center rounded-full border border-[rgba(168,184,204,0.2)] bg-[rgba(26,28,34,0.9)] px-4 text-sm font-semibold tracking-wide text-[#8fa6c4] shadow-[0_0_24px_-6px_rgba(95,114,140,0.6)]">
                  {step.n}
                </span>
                <h3 className="mt-5 text-lg font-semibold text-[#f7f7f7]">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#a8b8cc]">{step.line}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
