import { getFeedbackBreadcrumbs, type FeedbackBreadcrumb } from "./breadcrumbs";
import { getFeedbackConsoleErrors, type FeedbackConsoleError } from "./console-errors";

// Shared shape between the client-built preview and the server action's
// insert into founder_feedback.context (F1, build-queue.md). Every field
// here is route/device/timing metadata or a static breadcrumb label — see
// breadcrumbs.ts and console-errors.ts for why neither can ever carry form
// values, keystrokes, note contents, or student/parent data.
export interface FeedbackContext {
  route: string;
  page_title: string;
  breadcrumb: FeedbackBreadcrumb[];
  device: {
    user_agent: string;
    viewport: { width: number; height: number };
    theme: "light" | "dark";
  };
  timestamp: string;
  app_version: string;
  console_errors: FeedbackConsoleError[];
}

export function buildFeedbackContext(): FeedbackContext {
  return {
    route: window.location.pathname,
    page_title: document.title,
    breadcrumb: getFeedbackBreadcrumbs(),
    device: {
      user_agent: navigator.userAgent,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      theme: document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light",
    },
    timestamp: new Date().toISOString(),
    app_version: process.env.NEXT_PUBLIC_APP_VERSION ?? "dev",
    console_errors: getFeedbackConsoleErrors(),
  };
}
