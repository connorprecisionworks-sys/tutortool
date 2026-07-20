"use client";

import { useState } from "react";
import { studentJoinLink } from "@/lib/invite-link";
import { useToast } from "@/components/ui/toast";

export function CopyStudentCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  async function copy() {
    try {
      await navigator.clipboard.writeText(studentJoinLink(code));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      // E1 audit flow #4: this button's own label swap ("Copy link" ->
      // "Copied") is easy to miss in a dense table row, so a toast rides
      // along on top of it — same treatment given to the booking-links
      // list's re-copy button (app/tutor/booking-links/page.tsx).
      toast("Link copied to clipboard", { variant: "success" });
    } catch {
      // Clipboard access can be blocked; the code is still visible on the student's page.
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono text-xs text-text-tertiary">{code}</span>
      <button
        type="button"
        onClick={copy}
        title="Copy join link"
        className="text-xs text-text-tertiary hover:text-text"
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    </span>
  );
}
