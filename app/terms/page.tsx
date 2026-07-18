import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { TERMS_DOC } from "@/lib/legal/docs";
import { renderLegalBody } from "@/lib/legal/markdown";

export const metadata = {
  title: "Terms of Service — Slate",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-20 sm:px-10 sm:py-28">
      <Link href="/" aria-label="Slate home">
        <Logo className="h-6" />
      </Link>
      <h1 className="mt-10 text-3xl tracking-tight sm:text-4xl">{TERMS_DOC.title}</h1>
      <p className="mt-2 text-sm text-text-tertiary">
        Effective {TERMS_DOC.effectiveDate} · Version {TERMS_DOC.version}
      </p>

      <div className="mt-8 space-y-6 text-sm text-text-secondary sm:text-base [&_h2]:mt-4 [&_h2]:mb-1">
        {renderLegalBody(TERMS_DOC.body)}
      </div>
    </div>
  );
}
