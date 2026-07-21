"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { recordFeedbackBreadcrumb } from "@/lib/feedback/breadcrumbs";
import { installFeedbackErrorCapture } from "@/lib/feedback/console-errors";

/**
 * Mounted once in the tutor layout (F1, build-queue.md). Records a
 * "navigate" breadcrumb on every route change (route paths only — this
 * app's dynamic segments are UUIDs, never names, see lib/nav.ts /
 * app/tutor/students/[id]) and installs the error-capture listeners.
 * Button-click breadcrumbs are recorded directly at their own call sites
 * (AppShell nav, CommandPalette, FeedbackWidget) rather than a generic
 * DOM listener here, so every possible label stays a hardcoded string —
 * see breadcrumbs.ts.
 */
export function FeedbackTracker() {
  const pathname = usePathname();

  useEffect(() => {
    installFeedbackErrorCapture();
  }, []);

  useEffect(() => {
    recordFeedbackBreadcrumb("navigate", pathname);
  }, [pathname]);

  return null;
}
