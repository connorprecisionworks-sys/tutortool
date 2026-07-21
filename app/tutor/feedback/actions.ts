"use server";

import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import type { Json } from "@/lib/database.types";
import type { FeedbackContext } from "@/lib/feedback/context";

export type FeedbackCategory = "bug" | "idea" | "confusing" | "praise";

// Maps the widget's tutor-facing category to founder_feedback's existing
// `tag` values (bug/feature/ux/pricing/praise — see the F1 migration).
// "pricing" has no UI equivalent and stays reserved for founder-authored
// rows. A null category maps to a null tag ("no category" is a real,
// intentional state — the spec requires nothing but the text).
const CATEGORY_TO_TAG: Record<FeedbackCategory, string> = {
  bug: "bug",
  idea: "feature",
  confusing: "ux",
  praise: "praise",
};

export interface FeedbackFormResult {
  error?: string;
  ok?: boolean;
}

const BODY_MAX_LENGTH = 4000;

function truncate(value: unknown, max: number): string {
  return String(value ?? "").slice(0, max);
}

// Re-derives a clean context object from whatever the client sent rather
// than trusting it verbatim — a defense-in-depth cap on shape/size/counts
// on top of the client-side guarantees in lib/feedback/*, not a substitute
// for them (this can bound length, it can't tell a mislabeled breadcrumb
// from a safe one).
function sanitizeContext(raw: unknown): FeedbackContext {
  const c = (raw ?? {}) as Partial<FeedbackContext>;
  const breadcrumb = Array.isArray(c.breadcrumb) ? c.breadcrumb : [];
  const consoleErrors = Array.isArray(c.console_errors) ? c.console_errors : [];

  return {
    route: truncate(c.route, 300),
    page_title: truncate(c.page_title, 200),
    breadcrumb: breadcrumb.slice(-10).map((b) => ({
      type: b?.type === "navigate" ? "navigate" : "click",
      label: truncate(b?.label, 120),
      at: truncate(b?.at, 40),
    })),
    device: {
      user_agent: truncate(c.device?.user_agent, 300),
      viewport: {
        width: Number.isFinite(c.device?.viewport?.width) ? Math.round(c.device!.viewport!.width) : 0,
        height: Number.isFinite(c.device?.viewport?.height) ? Math.round(c.device!.viewport!.height) : 0,
      },
      theme: c.device?.theme === "dark" ? "dark" : "light",
    },
    timestamp: truncate(c.timestamp, 40),
    app_version: truncate(c.app_version, 60),
    console_errors: consoleErrors.slice(-5).map((e) => ({
      message: truncate(e?.message, 300),
      at: truncate(e?.at, 40),
    })),
  };
}

export async function submitFeedbackAction(input: {
  body: string;
  category: FeedbackCategory | null;
  context: FeedbackContext;
}): Promise<FeedbackFormResult> {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const body = input.body.trim();
  if (!body) return { error: "Enter a message before sending." };
  if (body.length > BODY_MAX_LENGTH) return { error: "Keep feedback under 4,000 characters." };

  const tag = input.category ? (CATEGORY_TO_TAG[input.category] ?? null) : null;
  const context = sanitizeContext(input.context);

  const { error } = await supabase.from("founder_feedback").insert({
    tutor_id: tutor.id,
    source: "in_app",
    tag,
    body,
    context: context as unknown as Json,
  });

  if (error) return { error: "Couldn't send feedback — try again." };
  return { ok: true };
}
