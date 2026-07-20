"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  variant = "ghost",
  size = "sm",
  className,
  onCopied,
  toastMessage,
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  className?: string;
  onCopied?: () => void;
  // Optional — most CopyButton call sites rely on the label swap above for
  // feedback; pass this for re-share surfaces (E3, build-queue.md) where a
  // toast earns its keep, e.g. a dense table row where the label swap alone
  // is easy to miss.
  toastMessage?: string;
}) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      if (toastMessage) toast(toastMessage, { variant: "success" });
      onCopied?.();
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
