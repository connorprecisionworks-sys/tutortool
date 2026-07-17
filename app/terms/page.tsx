import Link from "next/link";
import { Logo } from "@/components/brand/logo";

// TODO(connor): drafted from the app's actual functionality — have counsel
// review before treating this as final/binding, especially payments,
// liability, and governing-law sections.
export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-20 sm:px-10 sm:py-28">
      <Link href="/" aria-label="Slate home">
        <Logo className="h-6" />
      </Link>
      <h1 className="mt-10 text-3xl tracking-tight sm:text-4xl">Terms of service</h1>
      <p className="mt-2 text-sm text-text-tertiary">Last updated July 17, 2026</p>

      <div className="mt-8 space-y-8 text-sm text-text-secondary sm:text-base">
        <section>
          <h2 className="text-base font-semibold text-text sm:text-lg">Using Slate</h2>
          <p className="mt-2">
            Slate is billing and scheduling software for independent tutors. By creating an account, you agree
            to these terms. You&apos;re responsible for the accuracy of the rates, sessions, and invoices you
            enter, and for your own tax and business compliance obligations, Slate is a record-keeping and
            billing tool, not tax or legal advice.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text sm:text-lg">Accounts</h2>
          <p className="mt-2">
            You need a valid email to create an account. Tutors and parents each get their own account type;
            parents access data only for the students they&apos;re linked to. Keep your login credentials
            secure, you&apos;re responsible for activity under your account.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text sm:text-lg">Payments</h2>
          <p className="mt-2">
            Card payments are processed by Stripe. Tutors who accept payments through Slate do so via Stripe
            Connect and agree to Stripe&apos;s own terms. Slate isn&apos;t a party to the tutoring arrangement
            between a tutor and a family, we provide the software.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text sm:text-lg">Acceptable use</h2>
          <p className="mt-2">
            Don&apos;t use Slate to send content you don&apos;t have the right to send, to misrepresent charges,
            or to attempt to disrupt or gain unauthorized access to the service.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text sm:text-lg">Service &quot;as is&quot;</h2>
          <p className="mt-2">
            Slate is provided as is, without warranties of any kind. We work to keep the service reliable but
            don&apos;t guarantee uninterrupted availability.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text sm:text-lg">Changes</h2>
          <p className="mt-2">
            We may update these terms as Slate evolves. Material changes will be reflected by an updated date at
            the top of this page.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text sm:text-lg">Contact</h2>
          <p className="mt-2">
            Questions about these terms?{" "}
            <a href="mailto:hello@slatetutor.com" className="text-accent underline underline-offset-4 hover:text-text">
              hello@slatetutor.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
