import { Reveal } from "@/components/marketing/reveal";

const PAINS = [
  {
    title: "Chasing payments",
    line: "“Just checking in on that invoice” texts, again. Following up on money you already earned.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
    ),
  },
  {
    title: "Rebuilding the same invoice",
    line: "Every month, the same spreadsheet, the same copy-paste, the same math — by hand.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="7" y="3" width="13" height="17" rx="2" />
        <path d="M4 7v12a2 2 0 0 0 2 2h9" />
        <path d="M11 8h5M11 12h4" />
      </svg>
    ),
  },
  {
    title: "Admin eating your evenings",
    line: "The teaching ends at 7. The bookkeeping starts at 10. That math never worked.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10Z" />
      </svg>
    ),
  },
];

export function Problem() {
  return (
    <section className="relative overflow-hidden px-6 py-20 sm:px-10 sm:py-28">
      {/* section accent */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-[-10%] top-0 h-[420px] w-[520px] rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(95,114,140,0.12), transparent 70%)" }}
      />
      <div className="relative mx-auto max-w-6xl">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#7a8699]">Sound familiar?</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-[-0.02em] text-[#f7f7f7] sm:text-4xl">
            Tutoring is the job.{" "}
            <span className="bg-gradient-to-r from-[#8fa6c4] to-[#5f728c] bg-clip-text text-transparent">
              The admin is the tax.
            </span>
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {PAINS.map((pain, i) => (
            <Reveal key={pain.title} delay={i * 90}>
              <div className="group h-full rounded-2xl border border-[rgba(168,184,204,0.1)] bg-[rgba(30,32,38,0.5)] p-6 backdrop-blur-sm transition duration-200 hover:border-[rgba(168,184,204,0.28)] hover:bg-[rgba(30,32,38,0.75)] hover:shadow-[0_0_50px_-16px_rgba(95,114,140,0.5)] motion-safe:hover:-translate-y-1">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[rgba(95,114,140,0.15)] text-[#8fa6c4] ring-1 ring-inset ring-[rgba(168,184,204,0.18)] transition duration-200 group-hover:text-[#a8b8cc] group-hover:shadow-[0_0_20px_rgba(95,114,140,0.5)]">
                  {pain.icon}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-[#f7f7f7]">{pain.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#a8b8cc]">{pain.line}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
