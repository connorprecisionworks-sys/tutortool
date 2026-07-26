import { HeroScene } from "@/components/marketing/hero-scene";
import { WaitlistForm } from "@/components/marketing/waitlist-form";

const PARTICLES = [
  { left: "6%", top: "58%", size: 3, dur: "11s", delay: "0s", color: "#5f728c" },
  { left: "14%", top: "80%", size: 2, dur: "14s", delay: "2s", color: "#a8b8cc" },
  { left: "27%", top: "68%", size: 2, dur: "12s", delay: "5s", color: "#5f728c" },
  { left: "38%", top: "84%", size: 3, dur: "16s", delay: "1s", color: "#a8b8cc" },
  { left: "49%", top: "72%", size: 2, dur: "10s", delay: "6.5s", color: "#8fa6c4" },
  { left: "61%", top: "86%", size: 3, dur: "13s", delay: "0.5s", color: "#5f728c" },
  { left: "72%", top: "64%", size: 2, dur: "15s", delay: "7s", color: "#a8b8cc" },
  { left: "81%", top: "78%", size: 2, dur: "12s", delay: "3.5s", color: "#8fa6c4" },
  { left: "90%", top: "70%", size: 3, dur: "14s", delay: "4.5s", color: "#5f728c" },
  { left: "96%", top: "82%", size: 2, dur: "11s", delay: "8s", color: "#a8b8cc" },
];

/**
 * Cinematic dark hero — the one place the brand goes full Linear/Resend:
 * layered slate aurora, drifting bokeh orbs, a perspective grid floor, film
 * grain, rising particles, a light beam that periodically sweeps the band,
 * and the product floating in the middle of it (HeroScene). Strictly the
 * brand slate family — the drama is light and depth, not new colors.
 */
export function WaitlistHero() {
  return (
    <section className="relative overflow-hidden bg-[#121214] px-6 pb-24 pt-16 sm:px-10 sm:pb-32 sm:pt-24">
      {/* --- atmosphere --- */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="hero-aurora-a absolute inset-0" />
        <div className="hero-aurora-b absolute inset-0" />
        {/* bokeh orbs — big, blurred, slow */}
        <div
          className="absolute left-[8%] top-[12%] h-56 w-56 rounded-full opacity-30 blur-3xl motion-safe:animate-[orb-drift_20s_ease-in-out_infinite_alternate]"
          style={{ background: "radial-gradient(circle, rgba(95,114,140,0.55), transparent 70%)" }}
        />
        <div
          className="absolute right-[4%] top-[38%] h-72 w-72 rounded-full opacity-25 blur-3xl motion-safe:animate-[orb-drift_26s_ease-in-out_infinite_alternate-reverse]"
          style={{ background: "radial-gradient(circle, rgba(168,184,204,0.4), transparent 70%)" }}
        />
        <div
          className="absolute bottom-[8%] left-[38%] h-64 w-64 rounded-full opacity-20 blur-3xl motion-safe:animate-[orb-drift_23s_ease-in-out_infinite_alternate]"
          style={{ background: "radial-gradient(circle, rgba(95,114,140,0.5), transparent 70%)" }}
        />
        {/* periodic light beam sweeping the band */}
        <div
          className="absolute inset-y-[-30%] left-[10%] w-[45%] motion-safe:animate-[beam-sweep_8s_ease-in-out_infinite]"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(168,184,204,0.07) 45%, rgba(168,184,204,0.11) 50%, rgba(168,184,204,0.07) 55%, transparent)",
          }}
        />
        {/* grid floor, receding to the horizon */}
        <div className="hero-grid absolute inset-x-[-20%] bottom-[-12%] h-[55%]" />
        {/* rising particles */}
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="absolute rounded-full opacity-0 motion-safe:animate-[particle-rise_linear_infinite]"
            style={{
              left: p.left,
              top: p.top,
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
              animationDuration: p.dur,
              animationDelay: p.delay,
            }}
          />
        ))}
        {/* film grain */}
        <div className="hero-noise absolute inset-0" />
        {/* settle into the page's canvas color at the bottom edge */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[#121214]" />
      </div>

      {/* --- content --- */}
      <div className="relative mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
        <div>
          <p className="motion-safe:animate-[fade-rise-in_0.5s_ease-out_both]">
            <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(168,184,204,0.2)] bg-[rgba(30,32,38,0.6)] px-3.5 py-1.5 text-xs font-medium tracking-wide text-[#a8b8cc] backdrop-blur">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#5f728c] motion-safe:animate-[ring-pulse_2s_ease-out_infinite]" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#8fa6c4]" />
              </span>
              Early access · Built for tutors
            </span>
          </p>
          <h1 className="mt-6 font-bold leading-[1.02] tracking-[-0.03em] text-[#f7f7f7]">
            <span className="block text-5xl sm:text-6xl xl:text-7xl motion-safe:animate-[fade-rise-in_0.6s_ease-out_0.1s_both]">
              Getting paid,
            </span>
            <span className="text-shimmer block bg-gradient-to-r from-[#8fa6c4] via-[#e3ebf5] to-[#5f728c] bg-clip-text text-5xl text-transparent sm:text-6xl xl:text-7xl motion-safe:animate-[fade-rise-in_0.6s_ease-out_0.25s_both]">
              on autopilot.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-[#a8b8cc] sm:text-lg motion-safe:animate-[fade-rise-in_0.6s_ease-out_0.4s_both]">
            You didn&apos;t start tutoring to chase payments and rebuild invoices at 11pm. Slate is the
            back office for tutors — rates, sessions, invoices, and getting paid, handled.
          </p>
          <div id="waitlist" className="mt-9 scroll-mt-24 motion-safe:animate-[fade-rise-in_0.6s_ease-out_0.55s_both]">
            <WaitlistForm id="waitlist-email-hero" source="landing-hero" />
          </div>
        </div>

        <div className="pb-14 pt-10 lg:pb-16">
          <HeroScene />
        </div>
      </div>
    </section>
  );
}
