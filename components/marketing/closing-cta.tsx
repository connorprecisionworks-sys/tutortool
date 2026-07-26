import { Reveal } from "@/components/marketing/reveal";
import { WaitlistForm } from "@/components/marketing/waitlist-form";

/**
 * The finale — mirrors the hero's atmosphere (aurora, grid floor, grain) so
 * the page closes where it opened: in the dark, with one thing to do.
 */
export function ClosingCta() {
  return (
    <section className="relative overflow-hidden px-6 py-24 sm:px-10 sm:py-36">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="hero-aurora-a absolute inset-0 opacity-80" />
        <div className="hero-aurora-b absolute inset-0" />
        <div className="hero-grid absolute inset-x-[-20%] bottom-[-14%] h-[60%]" />
        <div className="hero-noise absolute inset-0" />
      </div>
      <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#7a8699]">Early access</p>
          <h2 className="mt-4 text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-[#f7f7f7] sm:text-5xl">
            You teach.{" "}
            <span className="text-shimmer bg-gradient-to-r from-[#8fa6c4] via-[#e3ebf5] to-[#5f728c] bg-clip-text text-transparent">
              Slate handles the rest.
            </span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base text-[#a8b8cc] sm:text-lg">
            First spots go to the waitlist — free early access, and a real say in what gets built.
          </p>
        </Reveal>
        <Reveal delay={140} className="mt-9 flex w-full justify-center">
          <WaitlistForm id="waitlist-email-closing" source="landing-closing" />
        </Reveal>
      </div>
    </section>
  );
}
