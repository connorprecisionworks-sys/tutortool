import posthog from "posthog-js";

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
  api_host: "/ingest",
  ui_host: "https://us.posthog.com",
  defaults: "2026-01-30",
  capture_exceptions: true,
  debug: process.env.NODE_ENV === "development",
  // Session replay. Recording must also be toggled ON in PostHog project
  // settings (Settings -> Session replay). Config below is privacy-first
  // because Slate handles student/parent PII and payment data:
  //  - every form input is masked (names, emails, dollar amounts, notes)
  //  - anything you explicitly mark with `ph-mask` is scrubbed from the DOM
  //  - anything marked `ph-no-capture` is dropped entirely
  // To reveal a specific safe element, add className "ph-no-mask".
  session_recording: {
    maskAllInputs: true,
    maskTextSelector: ".ph-mask",
    blockSelector: ".ph-no-capture",
  },
});
