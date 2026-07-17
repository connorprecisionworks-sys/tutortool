import Link from "next/link";
import { Logo } from "@/components/brand/logo";

// TODO(connor): drafted from the app's actual data flows (Supabase, Stripe,
// Resend, Twilio, PostHog) — have counsel review before treating this as
// final/binding, especially the sections on student data and payment
// processing.
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-20 sm:px-10 sm:py-28">
      <Link href="/" aria-label="Slate home">
        <Logo className="h-6" />
      </Link>
      <h1 className="mt-10 text-3xl tracking-tight sm:text-4xl">Privacy policy</h1>
      <p className="mt-2 text-sm text-text-tertiary">Last updated July 17, 2026</p>

      <div className="mt-8 space-y-8 text-sm text-text-secondary sm:text-base">
        <section>
          <h2 className="text-base font-semibold text-text sm:text-lg">What we collect</h2>
          <p className="mt-2">
            When you create an account, we collect your name, email, and role (tutor or parent). Tutors using
            Slate enter business data, rates, services, sessions, invoices, expenses, and information about the
            students they tutor (names and scheduling details a tutor chooses to record). Parents who link to a
            student see and can add information scoped to their own child.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text sm:text-lg">Payments</h2>
          <p className="mt-2">
            Card payments are processed by Stripe. We don&apos;t store full card numbers ourselves; Stripe
            handles that under its own privacy policy. Tutors who accept payments through Slate use Stripe
            Connect, which requires identity and payout information Stripe collects directly.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text sm:text-lg">Email and SMS</h2>
          <p className="mt-2">
            Invoice and reminder emails are sent through Resend. If a tutor enables SMS reminders, those are
            sent through Twilio. We share only what&apos;s needed to deliver the message, recipient address and
            message content.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text sm:text-lg">Analytics</h2>
          <p className="mt-2">
            We use PostHog to understand how Slate is used and to improve it. Session replay, where enabled,
            masks all form input by default, names, emails, dollar amounts, and notes are never captured in a
            recording.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text sm:text-lg">Student data</h2>
          <p className="mt-2">
            Student information in Slate is entered by tutors and parents, not by students directly. Students
            don&apos;t create their own accounts. If you&apos;re a parent and want student information removed,
            contact us and we&apos;ll work with you.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text sm:text-lg">Your rights</h2>
          <p className="mt-2">
            You can access, correct, or ask us to delete your account data at any time by contacting us. We
            retain data for as long as your account is active, plus a reasonable period afterward for financial
            recordkeeping.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text sm:text-lg">Contact</h2>
          <p className="mt-2">
            Questions about this policy?{" "}
            <a href="mailto:hello@slatetutor.com" className="text-accent underline underline-offset-4 hover:text-text">
              hello@slatetutor.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
