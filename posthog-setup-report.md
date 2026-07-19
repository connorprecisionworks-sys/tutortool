<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into Slate (Tutortool). The following changes were made:

- **`instrumentation-client.ts`** — Created: initialises `posthog-js` for browser-side tracking via the Next.js 15.3+ instrumentation hook, with a reverse-proxy `api_host` to route events through `/ingest` and `capture_exceptions: true` for automatic error tracking.
- **`lib/posthog-server.ts`** — Created: a singleton `posthog-node` client (flushAt 1 / flushInterval 0) for server-side event capture in Server Actions and API routes.
- **`next.config.ts`** — Extended with `async rewrites()` routing `/ingest/static/*`, `/ingest/array/*`, and `/ingest/*` to PostHog US asset and ingest origins, plus `skipTrailingSlashRedirect: true`.
- **`components/posthog-identifier.tsx`** — Created: a lightweight Client Component that calls `posthog.identify()` with the authenticated user's Supabase auth ID, name, email, and role on every page load.
- **`app/tutor/layout.tsx`** — Added `<PostHogIdentifier>` so every tutor session is identified against the tutor's `auth_user_id`.
- **`app/parent/layout.tsx`** — Added `<PostHogIdentifier>` so every parent session is identified against the parent's `auth_user_id`.
- **`app/(auth)/actions.ts`** — Captures `tutor_signed_up` / `parent_signed_up` on the server immediately after a successful sign-up session is created, and identifies the new user.
- **`app/tutor/students/actions.ts`** — Captures `student_added` with `rate_type` and `is_philanthropic` properties after a student is successfully created.
- **`app/tutor/sessions/actions.ts`** — Captures `session_logged` with `duration_minutes`, `travel_minutes`, `bill_travel`, `has_location`, and `has_notes` properties after a session is successfully inserted.
- **`app/tutor/invoices/actions.ts`** — Captures `invoice_created`, `invoice_sent`, and `invoice_paid_manually` at their respective success paths.
- **`app/api/webhooks/stripe/route.ts`** — Captures `invoice_paid` (Stripe) with `total_cents` and `payment_method` after the DB update succeeds, using the tutor's `auth_user_id` fetched from the invoices/tutors join.
- **`app/tutor/settings/stripe-actions.ts`** — Captures `stripe_connect_started` with `is_new_account` after a Stripe Account Link is successfully created.
- **`app/tutor/invoices/reminder-actions.ts`** — Captures `payment_reminder_sent` with `invoice_id` and `template_key` after an email reminder is delivered.
- **`app/parent/schedule/actions.ts`** — Captures `session_booking_requested` with `duration_minutes` after a booking is created.
- **`app/parent/actions.ts`** — Captures `parent_invite_redeemed` after a parent successfully redeems a student invite code.

## Events

| Event | Description | File |
|-------|-------------|------|
| `tutor_signed_up` | A new tutor created an account. | `app/(auth)/actions.ts` |
| `parent_signed_up` | A new parent created an account. | `app/(auth)/actions.ts` |
| `student_added` | A tutor added a new student to their roster. | `app/tutor/students/actions.ts` |
| `session_logged` | A tutor logged a completed tutoring session. | `app/tutor/sessions/actions.ts` |
| `invoice_created` | A tutor created a draft invoice. | `app/tutor/invoices/actions.ts` |
| `invoice_sent` | A tutor sent an invoice to a parent. | `app/tutor/invoices/actions.ts` |
| `invoice_paid` | An invoice was paid via Stripe checkout. | `app/api/webhooks/stripe/route.ts` |
| `invoice_paid_manually` | A tutor marked an invoice as paid manually. | `app/tutor/invoices/actions.ts` |
| `stripe_connect_started` | A tutor started Stripe Connect onboarding. | `app/tutor/settings/stripe-actions.ts` |
| `payment_reminder_sent` | A tutor sent a payment reminder email to a parent. | `app/tutor/invoices/reminder-actions.ts` |
| `session_booking_requested` | A parent submitted a session booking request. | `app/parent/schedule/actions.ts` |
| `parent_invite_redeemed` | A parent redeemed a student invite code to link their child. | `app/parent/actions.ts` |

## Next steps

We've built a dashboard and five insights to keep an eye on user behaviour, based on the events we just instrumented:

- [Analytics basics (wizard) — dashboard](https://us.posthog.com/project/515401/dashboard/1859176)
- [Tutor signups (wizard)](https://us.posthog.com/project/515401/insights/dPQiJKSb)
- [Invoice lifecycle funnel (wizard)](https://us.posthog.com/project/515401/insights/3YtU6SeI)
- [Sessions logged (wizard)](https://us.posthog.com/project/515401/insights/lMIiU2Ml)
- [Invoices paid (wizard)](https://us.posthog.com/project/515401/insights/KUAvPlr2)
- [Stripe Connect onboarding (wizard)](https://us.posthog.com/project/515401/insights/9bt7Mivs)

## Verify before merging

- [ ] Run a full production build (`npm run build`) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` to `.env.example` and any monorepo/bootstrap scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify.
- [ ] Confirm the returning-visitor path also calls `identify` — `PostHogIdentifier` runs on every render of `/tutor/*` and `/parent/*` layouts, so returning visitors are covered; verify this holds after any future layout refactors.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
