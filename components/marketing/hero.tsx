import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/marketing/reveal";
import { AnimatedHeadline } from "@/components/marketing/animated-headline";
import { HeroMockup } from "@/components/marketing/hero-mockup";

export function Hero() {
  return (
    <section className="px-6 pb-16 pt-16 sm:px-10 sm:pb-24 sm:pt-24">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl tracking-tight sm:text-5xl md:text-6xl">
          <AnimatedHeadline text="Run your business. Focus on what matters." />
        </h1>
        <Reveal delay={80}>
          <p className="mx-auto mt-6 max-w-xl text-base text-text-secondary sm:text-lg">
            Slate is the back office for independent tutors. Rates, sessions, invoices, scheduling, and
            getting paid, handled, so you can focus on teaching.
          </p>
        </Reveal>
        <Reveal delay={160}>
          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/signup/tutor">
              <Button size="md" className="h-11 px-6 text-sm motion-safe:hover:scale-[1.03]">
                Sign up free
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button variant="secondary" size="md" className="h-11 px-6 text-sm">
                See how it works
              </Button>
            </a>
          </div>
        </Reveal>
      </div>
      <div className="mx-auto mt-16 max-w-4xl">
        <HeroMockup />
      </div>
    </section>
  );
}
