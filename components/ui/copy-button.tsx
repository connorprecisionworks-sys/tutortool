"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  variant = "ghost",
  size = "sm",
  className,
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be blocked; the value is still visible to select manually.
    }
  }

  return (
    <Button type="button" variant={variant} size={size} className={className} onClick={copy}>
      {copied ? copiedLabel : label}
    </Button>
  );
}
