"use client";

import { useState } from "react";
import { studentJoinLink } from "@/lib/invite-link";

export function CopyStudentCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(studentJoinLink(code));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
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
