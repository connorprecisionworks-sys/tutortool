import { Reveal } from "@/components/marketing/reveal";

const cardBase =
  "group relative h-full overflow-hidden rounded-2xl border border-[rgba(168,184,204,0.1)] bg-[rgba(30,32,38,0.5)] p-6 backdrop-blur-sm transition duration-200 hover:border-[rgba(168,184,204,0.28)] hover:bg-[rgba(30,32,38,0.75)] hover:shadow-[0_0_60px_-18px_rgba(95,114,140,0.55)] motion-safe:hover:-translate-y-1";

/** Soft radial that brightens in a card's corner on hover. */
function CardGlow() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-0 blur-2xl transition duration-300 group-hover:opacity-100"
      style={{ background: "radial-gradient(circle, rgba(95,114,140,0.35), transparent 70%)" }}
    />
  );
}

/**
 * Bento grid — Linear/Vercel-school: mixed-size glass cards, each with a
 * small product vignette instead of an icon. The two wide cells anchor the
 * money story (invoices in, payments out); the smaller cells fill in the
 * rest of the back office.
 */
export function FeatureGrid() {
  return (
    <section id="features" className="relative scroll-mt-24 overflow-hidden px-6 py-20 sm:px-10 sm:py-28">
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(168,184,204,0.16)] to-transparent" />
      <div
        aria-hidden
        className="pointer-events-none absolute left-[30%] top-[-10%] h-[480px] w-[640px] rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(95,114,140,0.14), transparent 70%)" }}
      />
      <div className="relative mx-auto max-w-6xl">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#7a8699]">What you get</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-[-0.02em] text-[#f7f7f7] sm:text-4xl">
            A back office that{" "}
            <span className="bg-gradient-to-r from-[#8fa6c4] to-[#5f728c] bg-clip-text text-transparent">
              runs itself.
            </span>
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {/* One-tap invoices — wide anchor cell */}
          <Reveal className="lg:col-span-2">
            <div className={cardBase}>
              <CardGlow />
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-[#f7f7f7]">One-tap invoices</h3>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#a8b8cc]">
                    Built from your logged sessions and your rates. No spreadsheet, no math, no
                    rebuilding the same document every month.
                  </p>
                </div>
                {/* vignette: invoice resolving */}
                <div className="w-full max-w-[220px] shrink-0 rounded-xl border border-[rgba(168,184,204,0.14)] bg-[rgba(22,24,29,0.9)] p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium text-[#7a8699]">Invoice #48</p>
                    <span className="inline-flex items-center rounded-full bg-[#5f728c] px-2 py-0.5 text-[10px] font-semibold text-white shadow-[0_0_12px_rgba(95,114,140,0.7)]">
                      Paid
                    </span>
                  </div>
                  <p className="mt-2 tabular-nums text-lg font-semibold text-[#f7f7f7]">$440.00</p>
                  <div className="mt-3 space-y-1.5">
                    <div className="h-1.5 w-full rounded-full bg-[rgba(168,184,204,0.12)]" />
                    <div className="h-1.5 w-3/4 rounded-full bg-[rgba(168,184,204,0.12)]" />
                    <div className="h-1.5 w-1/2 rounded-full bg-[rgba(95,114,140,0.45)]" />
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Rates & services */}
          <Reveal delay={90}>
            <div className={cardBase}>
              <CardGlow />
              <div className="inline-flex items-center gap-2 rounded-lg border border-[rgba(168,184,204,0.16)] bg-[rgba(22,24,29,0.9)] px-3 py-1.5">
                <span className="tabular-nums text-sm font-semibold text-[#f7f7f7]">$85</span>
                <span className="text-xs text-[#7a8699]">/ hour · SAT prep</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[#f7f7f7]">Rates & services</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#a8b8cc]">
                Set them once. Every session and invoice prices itself from there.
              </p>
            </div>
          </Reveal>

          {/* Session tracking */}
          <Reveal>
            <div className={cardBase}>
              <CardGlow />
              <div className="flex gap-1.5">
                {["M", "T", "W", "T", "F"].map((d, i) => (
                  <span
                    key={i}
                    className={
                      i === 2
                        ? "flex h-8 w-8 items-center justify-center rounded-lg bg-[#5f728c] text-xs font-semibold text-white shadow-[0_0_14px_rgba(95,114,140,0.7)]"
                        : "flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(168,184,204,0.14)] bg-[rgba(22,24,29,0.9)] text-xs text-[#7a8699]"
                    }
                  >
                    {d}
                  </span>
                ))}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[#f7f7f7]">Session tracking</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#a8b8cc]">
                Your schedule, recurring students, and history — one calm place.
              </p>
            </div>
          </Reveal>

          {/* Booking links */}
          <Reveal delay={90}>
            <div className={cardBase}>
              <CardGlow />
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-[rgba(168,184,204,0.16)] bg-[rgba(22,24,29,0.9)] px-3 py-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8fa6c4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                <span className="truncate text-xs text-[#a8b8cc]">slate.tutor/book/you</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[#f7f7f7]">Booking links</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#a8b8cc]">
                Share a link, parents book you — slots come from your real availability.
              </p>
            </div>
          </Reveal>

          {/* Reminders */}
          <Reveal delay={180}>
            <div className={cardBase}>
              <CardGlow />
              <div className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(95,114,140,0.15)] ring-1 ring-inset ring-[rgba(168,184,204,0.18)]">
                <span aria-hidden className="absolute inset-0 rounded-xl border border-[#5f728c] opacity-0 motion-safe:animate-[ring-pulse_2.8s_ease-out_infinite]" />
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8fa6c4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[#f7f7f7]">Reminders that send themselves</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#a8b8cc]">
                Session reminders and payment nudges go out on their own — you never chase.
              </p>
            </div>
          </Reveal>

          {/* Card payments — wide closer cell */}
          <Reveal className="lg:col-span-3">
            <div className={cardBase}>
              <CardGlow />
              <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-lg font-semibold text-[#f7f7f7]">Parents pay by card</h3>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-[#a8b8cc]">
                    A payment link on every invoice. Money lands without the awkward follow-up —
                    that&apos;s the whole point.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="rounded-xl border border-[rgba(168,184,204,0.14)] bg-[rgba(22,24,29,0.9)] px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[#7a8699]">Payment</p>
                    <p className="mt-1 tabular-nums text-base font-semibold text-[#f7f7f7]">$240.00</p>
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5f728c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#5f728c] shadow-[0_0_24px_rgba(95,114,140,0.7)]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f7f7f7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
