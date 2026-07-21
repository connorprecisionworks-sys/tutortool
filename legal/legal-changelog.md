# Slate Legal Docs Changelog

Track every change to the Terms of Service and Privacy Policy. Bump the Effective Date + version in the docs whenever they change, and log it here.

| Date | Docs | Version | What changed |
|---|---|---|---|
| 2026-07-20 | Privacy | 2.2 | F1: in-app feedback widget. A Tutor can send feedback from inside Slate; each submission auto-attaches a diagnostic mini-report (current page, a breadcrumb of button labels/pages navigated, device/browser, screen size, theme, timestamp, and recent app errors) shown to the Tutor before sending. Added a data-collection bullet (Privacy) covering this. No new subprocessor, not public-facing, ToS unchanged — this is a new type of data collected under the standing rule. |
| 2026-07-19 | ToS + Privacy | 2.1 | D13: gated/paid resources. A Tutor can mark a resource as paid; a Parent must complete payment (via an invoice add-on, same Stripe processing already described) before it unlocks, or the Tutor can manually unlock it. Added a Payments and Billing bullet (ToS) and a data-collection bullet (Privacy) covering this — no new subprocessor, just a new access-control condition on existing resource/invoice data. |
| 2026-07-18 | ToS + Privacy | 2.0 | Rewrote both to match current Slate: added scheduling/booking + public tutor pages, parent portal, session notes, file uploads (receipts/photos), expenses + mileage, email/SMS reminders + consent (STOP/HELP), and named subprocessors (Stripe, Supabase, Vercel, PostHog, Resend, Twilio). Added ToS boilerplate (entire agreement, severability, assignment, force majeure), informal dispute step, US data-location note. Set effective date. |
| (template) | ToS + Privacy | 1.0 | Original template: billing-only description, Stripe, CCPA, Florida law, adults-only/COPPA framing. |

## Rule

Any feature that (a) collects a new type of data, (b) adds a new subprocessor, (c) changes how data is shared, or (d) adds a public-facing surface must update the docs, bump the Effective Date + version, and add a row here. This rule is also in build-queue.md as a standing global rule so the build loop enforces it.
