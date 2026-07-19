"use client";

import { useDismissible } from "@/lib/hooks/use-dismissible";
import { DismissButton } from "@/components/ui/dismiss-button";

const KEY = "slate-announcement-dismissed";

export function AnnouncementBar({ message }: { message: string }) {
  const { dismissed, dismiss } = useDismissible(KEY);

  if (dismissed) return null;

  return (
    <div className="flex items-center justify-center gap-3 bg-accent/10 px-4 py-2 text-center text-xs text-text sm:text-sm">
      <p>{message}</p>
      <DismissButton
        onClick={dismiss}
        label="Dismiss announcement"
        className="flex h-11 w-11 shrink-0 items-center justify-center text-text-secondary hover:text-text sm:h-auto sm:w-auto"
      />
    </div>
  );
}
