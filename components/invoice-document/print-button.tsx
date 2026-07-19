"use client";

// Deliberately not the shared <Button> — it uses --accent/--accent-text
// theme tokens, which flip to a white fill in dark mode. This page always
// renders as a fixed white "paper" document (see app/invoice/[id]/page.tsx),
// so a dark-mode Button would render near-invisible white-on-white.
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden inline-flex h-9 items-center justify-center rounded-lg bg-[#161616] px-4 text-sm font-medium text-white hover:opacity-90"
    >
      Print / Save as PDF
    </button>
  );
}
