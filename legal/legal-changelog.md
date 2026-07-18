# Slate Legal Docs Changelog

Track every change to the Terms of Service and Privacy Policy. Bump the Effective Date + version in the docs whenever they change, and log it here.

| Date | Docs | Version | What changed |
|---|---|---|---|
| 2026-07-18 | ToS + Privacy | 2.0 | Rewrote both to match current Slate: added scheduling/booking + public tutor pages, parent portal, session notes, file uploads (receipts/photos), expenses + mileage, email/SMS reminders + consent (STOP/HELP), and named subprocessors (Stripe, Supabase, Vercel, PostHog, Resend, Twilio). Added ToS boilerplate (entire agreement, severability, assignment, force majeure), informal dispute step, US data-location note. Set effective date. |
| (template) | ToS + Privacy | 1.0 | Original template: billing-only description, Stripe, CCPA, Florida law, adults-only/COPPA framing. |

## Rule

Any feature that (a) collects a new type of data, (b) adds a new subprocessor, (c) changes how data is shared, or (d) adds a public-facing surface must update the docs, bump the Effective Date + version, and add a row here. This rule is also in build-queue.md as a standing global rule so the build loop enforces it.
