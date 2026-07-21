// F1 (build-queue.md): a tiny local breadcrumb trail for the feedback
// widget's diagnostic mini-report — deliberately NOT a generic "log
// whatever text is inside the clicked element" tracker. Every call site
// that invokes recordFeedbackBreadcrumb() passes a hardcoded, static
// string (a nav label, a command-palette action name, "Opened feedback").
// That's the actual privacy guarantee: grep for recordFeedbackBreadcrumb(
// to audit every possible label this trail can ever contain — none of
// them are derived from form values, row data, or anything a tutor typed.
// The one exception (selecting a student in the command palette) is
// deliberately redacted to a fixed generic label, never the student's name.

export interface FeedbackBreadcrumb {
  type: "click" | "navigate";
  label: string;
  at: string;
}

const MAX_BREADCRUMBS = 10;
const STORAGE_KEY = "slate_feedback_breadcrumbs";

function readAll(): FeedbackBreadcrumb[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items: FeedbackBreadcrumb[]) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-MAX_BREADCRUMBS)));
  } catch {
    // sessionStorage unavailable (private browsing / quota) — the trail
    // just stays empty for this tab. Never throw for a diagnostic nicety.
  }
}

export function recordFeedbackBreadcrumb(type: FeedbackBreadcrumb["type"], label: string) {
  const items = readAll();
  items.push({ type, label, at: new Date().toISOString() });
  writeAll(items);
}

export function getFeedbackBreadcrumbs(): FeedbackBreadcrumb[] {
  return readAll();
}
