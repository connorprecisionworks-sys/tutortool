import Link from "next/link";
import Image from "next/image";

export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative border-t border-[rgba(168,184,204,0.1)] px-6 py-16 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Image src="/brand/logo/slate-logo-on-dark.svg" alt="Slate" width={886} height={236} className="h-6 w-auto" />
            <p className="mt-3 max-w-[240px] text-sm text-[#7a8699]">
              The back office for tutors. Run your business. Focus on what matters.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-[#a8b8cc]">
            <Link href="/about" className="transition duration-150 hover:text-[#f7f7f7]">
              About
            </Link>
            <a href="mailto:hello@slatetutor.com" className="transition duration-150 hover:text-[#f7f7f7]">
              Contact
            </a>
            <Link href="/privacy" className="transition duration-150 hover:text-[#f7f7f7]">
              Privacy
            </Link>
            <Link href="/terms" className="transition duration-150 hover:text-[#f7f7f7]">
              Terms
            </Link>
            <Link href="/login" className="transition duration-150 hover:text-[#f7f7f7]">
              Log in
            </Link>
          </nav>
        </div>
        <div className="mt-12 border-t border-[rgba(168,184,204,0.08)] pt-6 text-xs text-[#7a8699]">
          <p>© {year} Slate. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
