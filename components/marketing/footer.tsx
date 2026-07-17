import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function MarketingFooter({ calcomLink }: { calcomLink: string }) {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border px-6 py-16 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-5">
          <div className="col-span-2">
            <Logo className="h-6" />
            <p className="mt-3 max-w-[220px] text-sm text-text-secondary">The back office for independent tutors.</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-text-tertiary">Product</p>
            <ul className="mt-3 space-y-2 text-sm text-text-secondary">
              <li>
                <a href="#features" className="hover:text-text">
                  Features
                </a>
              </li>
              <li>
                <Link href="/tutor/booking-links" className="hover:text-text">
                  Booking
                </Link>
              </li>
              <li>
                <Link href="/parent" className="hover:text-text">
                  Parent portal
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-text-tertiary">Company</p>
            <ul className="mt-3 space-y-2 text-sm text-text-secondary">
              <li>
                <Link href="/about" className="hover:text-text">
                  About
                </Link>
              </li>
              <li>
                <a href="mailto:hello@slatetutor.com" className="hover:text-text">
                  Contact
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-text-tertiary">Resources</p>
            <ul className="mt-3 space-y-2 text-sm text-text-secondary">
              <li>
                <a href={calcomLink} target="_blank" rel="noopener noreferrer" className="hover:text-text">
                  Book a demo
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-14 flex flex-col gap-4 border-t border-border pt-6 text-xs text-text-tertiary sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Slate. All rights reserved.</p>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-text">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-text">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
