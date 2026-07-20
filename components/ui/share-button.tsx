"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

// Web Share API support never changes over a page's lifetime, so there's
// nothing to subscribe to — an empty subscribe is the documented
// useSyncExternalStore pattern for a one-time browser-only feature check
// (see components/theme-toggle.tsx for the same shape applied to
// data-theme). This avoids both a hydration mismatch (getServerSnapshot
// always returns false) and the "setState in an effect" anti-pattern.
function subscribe() {
  return () => {};
}

function getSnapshot(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Native mobile share sheet, alongside (never instead of) a Copy action —
 * Web Share API isn't available on most desktop browsers, so this renders
 * nothing unless a feature check confirms `navigator.share` exists.
 */
export function ShareButton({
  title,
  text,
  url,
  size = "sm",
  className,
}: {
  title: string;
  text?: string;
  url: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const supported = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!supported) return null;

  async function share() {
    try {
      await navigator.share({ title, text, url });
    } catch {
      // User cancelled the share sheet, or the platform rejected it —
      // Copy remains available right next to this button either way.
    }
  }

  return (
    <Button type="button" variant="ghost" size={size} className={className} onClick={share}>
      Share
    </Button>
  );
}
