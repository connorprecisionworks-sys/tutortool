import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/brand/logo";

export function MarketingHeader() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border px-6 sm:px-10">
      <Link href="/" aria-label="Slate home">
        <Logo className="h-6 sm:h-7" />
      </Link>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <Link href="/login">
          <Button variant="ghost" size="sm">
            Sign in
          </Button>
        </Link>
      </div>
    </header>
  );
}

export function Hero({ calcomLink }: { calcomLink: string }) {
  return (
    <section className="px-6 pb-20 pt-20 sm:px-10 sm:pb-28 sm:pt-28">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Back office for tutors.</p>
        <h1 className="mt-5 text-4xl tracking-tight sm:text-5xl md:text-6xl">
          Run your business. Focus on what matters.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base text-text-secondary sm:text-lg">
          Slate handles the money side, rates, sessions, invoices, and getting paid, so you can focus on
          teaching.
        </p>
        <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link href="/signup/tutor">
            <Button size="md" className="h-11 px-6 text-sm">
              Sign up free
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary" size="md" className="h-11 px-6 text-sm">
              Sign in
            </Button>
          </Link>
        </div>
        <a
          href={calcomLink}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-block text-sm text-text-secondary underline underline-offset-4 hover:text-text"
        >
          Book a demo
        </a>
      </div>
    </section>
  );
}

export function Problem() {
  return (
    <section className="border-t border-border px-6 py-20 sm:px-10 sm:py-28">
      <div className="mx-auto max-w-2xl">
        <div className="h-px w-12 bg-accent" />
        <h2 className="mt-5 text-2xl tracking-tight sm:text-3xl">
          Tutoring is a business. It shouldn&apos;t feel like one.
        </h2>
        <p className="mt-4 text-base text-text-secondary sm:text-lg">
          You set different rates for different families, drive across town, buy your own materials, and
          remind parents to pay over text. Slate runs the money side so you can focus on teaching.
        </p>
      </div>
    </section>
  );
}

const FEATURES = [
  {
    title: "Invoices that send themselves.",
    body: "Set it once. Slate generates and delivers invoices to parents automatically.",
  },
  {
    title: "Payments by card with Stripe.",
    body: "Parents pay online in a click, and funds land straight in your account.",
  },
  {
    title: "Session and travel-time tracking.",
    body: "Log sessions as you teach, including drive time, and bill for both.",
  },
  {
    title: "A portal for every parent.",
    body: "Each family gets its own portal to see sessions, invoices, and balances.",
  },
  {
    title: "Impact tracking for discounts and pro bono.",
    body: "See exactly what you've given back in reduced rates and free sessions.",
  },
  {
    title: "Business insights at a glance.",
    body: "Revenue, hours, and outstanding balances in one clean dashboard.",
  },
];

export function Features() {
  return (
    <section className="border-t border-border px-6 py-20 sm:px-10 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">What Slate does</p>
        <div className="mt-10 grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="border-t border-border pt-5">
              <h3 className="text-base tracking-tight">{feature.title}</h3>
              <p className="mt-2 text-sm text-text-secondary">{feature.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  "Set your rates and add students.",
  "Log sessions as you teach.",
  "Send invoices and invite parents, Slate handles the rest.",
];

export function HowItWorks() {
  return (
    <section className="border-t border-border px-6 py-20 sm:px-10 sm:py-28">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">How it works</p>
        <ol className="mt-10 grid grid-cols-1 gap-10 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step}>
              <span className="tabular-nums text-sm font-semibold text-accent">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="mt-3 text-base tracking-tight">{step}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function ClosingCta() {
  return (
    <section className="border-t border-border px-6 py-24 text-center sm:px-10 sm:py-32">
      <div className="mx-auto max-w-xl">
        <h2 className="text-3xl tracking-tight sm:text-4xl">Run your tutoring like a business.</h2>
        <p className="mt-4 text-base text-text-secondary sm:text-lg">Free to start.</p>
        <Link href="/signup/tutor" className="mt-8 inline-block">
          <Button size="md" className="h-11 px-6 text-sm">
            Sign up free
          </Button>
        </Link>
      </div>
    </section>
  );
}

export function MarketingFooter({ calcomLink }: { calcomLink: string }) {
  return (
    <footer className="border-t border-border px-6 py-10 sm:px-10">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 sm:flex-row sm:justify-between">
        <Logo className="h-5" />
        <p className="text-sm text-text-tertiary">slatetutor.com</p>
        <div className="flex items-center gap-6 text-sm text-text-secondary">
          <Link href="/login" className="hover:text-text">
            Sign in
          </Link>
          <a href={calcomLink} target="_blank" rel="noopener noreferrer" className="hover:text-text">
            Book a demo
          </a>
        </div>
      </div>
    </footer>
  );
}
