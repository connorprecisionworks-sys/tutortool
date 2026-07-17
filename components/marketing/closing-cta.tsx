import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/marketing/reveal";

export function ClosingCta({ calcomLink }: { calcomLink: string }) {
  return (
    <section className="border-t border-border px-6 py-24 text-center sm:px-10 sm:py-32">
      <Reveal className="mx-auto max-w-xl">
        <h2 className="text-3xl tracking-tight sm:text-4xl">Start running your tutoring like a business.</h2>
        <p className="mt-4 text-base text-text-secondary sm:text-lg">Free to start.</p>
        <Link href="/signup/tutor" className="mt-8 inline-block">
          <Button size="md" className="h-11 px-6 text-sm">
            Sign up free
          </Button>
        </Link>
        <a
          href={calcomLink}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 block text-sm text-text-secondary underline underline-offset-4 hover:text-text"
        >
          Book a demo
        </a>
      </Reveal>
    </section>
  );
}
