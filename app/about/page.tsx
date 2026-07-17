import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-20 sm:px-10 sm:py-28">
      <Link href="/" aria-label="Slate home">
        <Logo className="h-6" />
      </Link>
      <h1 className="mt-10 text-3xl tracking-tight sm:text-4xl">Back office for tutors.</h1>
      <div className="mt-6 space-y-4 text-base text-text-secondary sm:text-lg">
        <p>
          Slate handles the money side of independent tutoring, rates, sessions, invoices, scheduling, and
          getting paid, so you can focus on teaching.
        </p>
        <p>
          Tutors set their own rates and services, log sessions as they teach or send a booking link and let
          parents pick a time, and Slate turns that into invoices, reminders, and a running record of what&apos;s
          outstanding and what&apos;s been paid. Every family gets their own portal, scoped to their child, for
          notes, schedule, resources, and bills.
        </p>
        <p>We&apos;re a small, independent product. If you have questions, reach us any time.</p>
      </div>
      <a
        href="mailto:hello@slatetutor.com"
        className="mt-8 inline-block text-sm text-accent underline underline-offset-4 hover:text-text"
      >
        hello@slatetutor.com
      </a>
    </div>
  );
}
