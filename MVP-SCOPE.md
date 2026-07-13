# TutorTool — MVP Scope (Billing + Invoicing Engine)

Source of truth for the first build. Everything here is V1. Anything marked LATER is deliberately out of scope for the first ship.

---

## 1. What V1 does, in one line

A tutor adds their students, sets each one's rate, logs sessions as they happen, then hits "invoice" to send a Stripe payment link and watches it flip to Paid on its own, with auto-reminders chasing anyone who is late.

## 2. Core objects

- **User** — an auth account with a `role`: `tutor` or `parent`. Two signup flows, one users table.
- **Tutor** — the tutor's profile + business settings (standard rate, travel rule, invoice terms).
- **Student** — a child the tutor teaches. Holds the rate rule and philanthropic flag. Can optionally belong to a class.
- **Class (optional)** — a named group of students (for cohort/group tutoring). 1:1 tutors can ignore it.
- **Parent** — a parent user linked to one or more students via an invite code. Sees only their own child's data.
- **Invite** — a per-student code the tutor generates; the parent enters it to bind their account to that student.
- **Session** — one tutoring session: date, duration, location, travel time, billable-or-not. Can carry a shared note.
- **Session note** — the tutor's write-up for a session, optionally shared to the parent.
- **Availability + Booking** — tutor's open windows and the parent-requested or tutor-set bookings that become sessions.
- **Resource** — a file or link the tutor shares to a student/class, visible in the parent portal.
- **Invoice** — a bill for one student covering a set of sessions in a period. Has a status and a Stripe link.
- **Invoice line item** — one session (or adjustment) on an invoice.
- **Payment** — the Stripe payment event that marks an invoice paid.

## 3. Billing model (the heart of it)

Each client has a **rate rule**, one of:

- `standard` — the tutor's default hourly rate.
- `professional_discount` — standard minus a set percent or a custom hourly number.
- `friend` — a custom hourly rate for close friends.
- `low_income` — a discounted hourly rate.
- `pro_bono` — $0 billed, but value still tracked (see philanthropic tracking).

Store it as: `rate_type` (enum) + `custom_rate_cents` (nullable, used when the type needs a specific number) + the tutor's `standard_rate_cents` as the fallback baseline. Resolve the effective hourly rate at billing time so changing the standard rate cascades correctly.

**Travel is billable.** Each session logs `travel_minutes`. The tutor sets a per-client or global rule: bill travel at the full session rate, at a reduced travel rate (`travel_rate_cents`), or not at all (`bill_travel = false`). Beth's ask: "duration expands based on time of travel" = the invoice line reflects session time plus travel time.

**Line amount** = `(duration_minutes/60 * effective_rate) + (travel_minutes/60 * travel_rate if bill_travel)`. Round to the cent. Always compute in integer cents, never floats.

## 4. Philanthropic tracking

When a session bills below the standard rate, the gap is the **value given**: `(standard_rate - effective_rate) * hours`, plus the full value of any pro-bono session. Tag each client/session `is_philanthropic` and roll these up into a "value given" total, split philanthropic vs regular discount.

HONEST CAVEAT (surface in the UI, do not imply it is a tax deduction): under US tax law you cannot deduct the value of donated services, only unreimbursed out-of-pocket expenses. So this number is for the tutor's own records, impact story, and conversations, not a line on a Schedule C. Word the UI as "value given / community impact," never "tax write-off."

## 5. Invoice lifecycle

`draft -> sent -> paid` (plus `overdue`, `void`).

1. **Draft** — tutor picks a client and a date range (or selects sessions), TutorTool bundles the unbilled sessions into a draft invoice with line items and a total. Tutor can add a manual line (e.g. a materials charge) or remove one.
2. **Send** — generates a Stripe invoice / payment link and emails or texts it to the parent. Status -> `sent`, timestamp recorded. Sessions on it are marked billed so they never double-invoice.
3. **Paid** — Stripe webhook (`invoice.paid` / `checkout.session.completed`) flips status -> `paid`, records `paid_at` and amount. No manual step needed.
4. **Manual mark-as-paid** — for tutors on Venmo/Zelle: a button that sets `paid` with a note (method = venmo/zelle/cash/other). Keeps the reconciliation honest without an API.
5. **Overdue** — if `sent` and past due date, status -> `overdue`, reminder engine engages.

## 6. Automated reminders

Config per tutor: due terms (e.g. due on receipt / net 7), reminder cadence (e.g. day of due, +3 days, +7 days), and channel (email V1; SMS LATER). A daily job scans `sent`/`overdue` invoices and sends the next reminder if one is due. Templates are editable and default to a warm, non-nagging tone (replaces Beth's manual copy-paste text). Every reminder logs so the tutor sees "reminded 2x."

## 7. Data model (V1, Supabase / Postgres)

Money is always integer cents. Timestamps `timestamptz`. RLS: a tutor sees only their own rows.

- `tutors` — `id`, `auth_user_id`, `name`, `email`, `standard_rate_cents`, `travel_rate_cents` (nullable), `bill_travel_default bool`, `stripe_account_id`, `invoice_terms`, `reminder_cadence jsonb`, `created_at`.
- `clients` — `id`, `tutor_id`, `student_name`, `payer_name`, `payer_email`, `payer_phone`, `rate_type enum`, `custom_rate_cents` (nullable), `bill_travel bool` (nullable, overrides default), `travel_rate_cents` (nullable), `is_philanthropic bool`, `notes`, `archived bool`, `created_at`.
- `sessions` — `id`, `tutor_id`, `client_id`, `occurred_on date`, `start_time` (nullable), `duration_minutes int`, `travel_minutes int default 0`, `location text` (nullable), `bill_travel bool` (resolved snapshot), `effective_rate_cents int` (snapshot at log time), `status enum: logged|billed`, `invoice_id` (nullable FK), `notes`, `created_at`.
- `invoices` — `id`, `tutor_id`, `client_id`, `period_start`, `period_end`, `subtotal_cents`, `total_cents`, `status enum: draft|sent|paid|overdue|void`, `due_date`, `stripe_invoice_id` (nullable), `stripe_payment_url` (nullable), `sent_at`, `paid_at`, `paid_method` (nullable), `created_at`.
- `invoice_line_items` — `id`, `invoice_id`, `session_id` (nullable, null = manual line), `description`, `quantity_minutes` (nullable), `amount_cents`.
- `reminders` — `id`, `invoice_id`, `sent_at`, `channel`, `template_key`.

Invariants: a `session` is billed exactly once (unique on `invoice_id` per session; guard on invoice send). `effective_rate_cents` is snapshotted onto the session when logged so back-dated rate changes never silently rewrite history. Invoice `total_cents` is the sum of its line items, always recomputed, never a free-floating field.

## 8. Screens (V1)

1. **Dashboard** — outstanding total, this-month billed, count of overdue invoices, quick "log session" and "new invoice" buttons.
2. **Clients** — list + add/edit client (name, payer contact, rate rule, travel rule, philanthropic flag).
3. **Log session** — fast entry: client, date, duration, travel time, location, notes. Defaults pulled from the client so it is two taps.
4. **Sessions** — filterable list, shows billed vs unbilled.
5. **New invoice** — pick client + date range, review auto-built line items, add/remove lines, send.
6. **Invoices** — list by status, invoice detail with Stripe link, mark-as-paid, resend, reminder history.
7. **Settings** — standard rate, travel rule, invoice terms, reminder cadence, Stripe connect, reminder templates.

Every prospect/customer-facing page runs through `prompts/page-depth-audit.md` before it is called done (empty states, smart defaults, inline edit, confirmations, no dead ends, light+dark, mobile).

## 9. Stripe integration

- **Connect** — Stripe Connect (Standard or Express) so each tutor gets paid into their own account; TutorTool is the platform. Onboard via Stripe's hosted flow.
- **Invoice send** — create a Stripe Invoice (or a Payment Link for lighter V1) for the total, store the URL, deliver it.
- **Webhook** — listen for `invoice.paid` / `checkout.session.completed`, verify signature, flip the matching invoice to `paid`. Idempotent on Stripe event id.
- **Fees** — ~2.9% + 30c per card charge, plus Connect platform terms. Set tutor expectation; optionally allow passing the fee to the payer as a line item.

## 10. Build phases (each pushed to main after its acceptance check passes)

- **P1 — Data + auth + clients.** Supabase schema, RLS, tutor auth, client CRUD with rate rules. Accept: a tutor signs in, adds a client with a friend rate, sees only their own data.
- **P2 — Sessions + rate math.** Log sessions with travel; effective-rate snapshot; billed/unbilled state. Accept: log a 90-min session + 20-min travel for a low-income client, the computed amount is correct to the cent.
- **P3 — Invoices (manual).** Build draft invoice from unbilled sessions, line items, totals, send (email link placeholder), manual mark-as-paid, sessions marked billed once. Accept: two sessions bundle into one invoice with the right total and never re-invoice.
- **P4 — Stripe.** Connect onboarding, real payment link, webhook auto-marks paid. Accept: a test payment flips the invoice to Paid with no manual action.
- **P5 — Reminders + philanthropic rollup + dashboard polish.** Daily reminder job, editable templates, value-given totals, dashboard numbers. Accept: an overdue invoice triggers a logged reminder; value-given total matches hand math.

### Platform expansion (two-sided) — see section 12 for detail

- **P6 — Roles + parent signup + invite codes.** Add `role` to users, a separate parent signup flow, per-student invite codes the tutor generates, parent onboarding that binds the account to the pre-added child. RLS so a parent sees only their child's rows. Accept: tutor adds a student and generates a code; a parent signs up, enters the code, and lands in a portal scoped to exactly that one child.
- **P7 — Session notes + parent notes view.** Tutor writes a note per session with a share toggle; shared notes appear in the parent portal. Accept: a tutor shares a note and the linked parent sees it; an unshared note stays private.
- **P8 — Resources library.** Tutor uploads files / adds links, scoped to a student or class; parent portal shows them. Accept: a resource attached to a student is visible to that student's parent only.
- **P9 — Scheduling.** Tutor availability + a tutor-selectable scheduling mode per student/class: (a) request-from-availability (parent requests, tutor approves), (b) calendar self-book (parent books an open slot, auto-confirm), (c) message/manual (tutor just records it, no parent booking). A confirmed booking creates a Session so it flows into billing. Accept: in each mode a confirmed booking produces a session that shows up for billing.
- **P10 — Parent billing view.** Parent sees their invoices and pays via the Stripe link from P4. Accept: a parent opens an invoice and completes a test payment that auto-marks it paid.
- **LATER (post-MVP):** expense + receipt capture, mileage from locations + gas prices, tax categorization, SMS reminders, recurring sessions, multi-tutor/team, calendar sync (Google/iCal).

## 11. Open questions for Connor / the team

- Stripe Connect flavor: Standard (tutor manages own Stripe, least liability) vs Express (smoother onboarding, more platform responsibility)?
- Who pays the Stripe fee, tutor or parent (line-item pass-through)?
- Email delivery provider for invoices + reminders (Resend / Postmark / SendGrid)?
- Is Beth's real first pain invoicing, or the travel-time billing specifically? Worth confirming in interview #2 (Donna Reed) before P2.

## 12. Platform expansion (two-sided: tutor + parent)

The billing engine (P1-P5) is single-user (the tutor). P6-P10 add the parent side and make it a platform. Build billing first so it proves out before the second audience lands on it.

### Roles + auth

- One `users` table, `role in ('tutor','parent')`. Two signup entry points (a tutor signup and a parent signup), same Supabase Auth underneath. Role decides which app shell loads: tutor dashboard vs parent portal.
- Parents never self-provision a student. The tutor pre-adds the student, so the child's record and rate exist before the parent arrives. This keeps data clean and billing correct.

### Invite flow (per-student code)

- Tutor adds a student, then hits "Invite parent," which generates a short code (e.g. 6-8 chars) and a shareable link, stored on an `invites` row (`student_id`, `code`, `status`, `expires_at`).
- Parent signs up and enters the code (or clicks the link). On match, create a `parent_students` link row binding that parent user to that student, mark the invite used. From then on the parent's every query is scoped through `parent_students`.
- A tutor can invite more than one parent to the same child (two guardians), and a parent can hold codes for multiple children.

### Parent portal (what the parent sees, all scoped to their child)

- Upcoming + past sessions for their child.
- Shared session notes.
- Resources shared to their child / class.
- Their invoices, with pay-now (Stripe).
- Scheduling: request or book depending on the tutor's chosen mode.
- Never sees other families, the tutor's other students, rate internals beyond their own amounts, or philanthropic tags.

### Scheduling (tutor keeps full control)

Tutor sets availability windows and picks a mode per student or class:
- **request** — parent requests a slot inside the tutor's availability; tutor approves or declines; approval creates a session.
- **calendar** — parent self-books an open slot; auto-confirms; creates a session.
- **message** — no parent booking; tutor records sessions manually (matches Beth's current text-to-schedule habit). This is the zero-friction default.

A confirmed booking always produces a `sessions` row so scheduling feeds billing with no double entry. Bookings carry the same duration + travel fields so the rate math is unchanged.

### Data model additions (V2, on top of section 7)

- `users` — `id`, `auth_user_id`, `role enum('tutor','parent')`, `name`, `email`, `created_at`. (Tutor business fields stay on `tutors`, keyed to the tutor user.)
- `classes` — `id`, `tutor_id`, `name`, `created_at`. (optional grouping)
- `students` — rename/extend the V1 `clients` concept: `id`, `tutor_id`, `class_id` (nullable), `student_name`, rate fields, `is_philanthropic`, `archived`. Payer contact now lives via `parent_students` rather than free-text fields.
- `parent_students` — `id`, `parent_user_id`, `student_id`, `relationship` (nullable), `created_at`. The isolation backbone; RLS joins through this.
- `invites` — `id`, `tutor_id`, `student_id`, `code` (unique), `status enum('open','used','revoked')`, `expires_at`, `created_at`.
- `session_notes` — `id`, `session_id`, `tutor_id`, `body`, `shared bool default false`, `created_at`, `updated_at`.
- `availability` — `id`, `tutor_id`, `weekday` or explicit window `start_ts`/`end_ts`, `created_at`.
- `bookings` — `id`, `tutor_id`, `student_id`, `requested_start`, `duration_minutes`, `status enum('requested','confirmed','declined','cancelled')`, `mode enum('request','calendar','message')`, `session_id` (nullable FK once confirmed), `created_at`.
- `resources` — `id`, `tutor_id`, `student_id` (nullable), `class_id` (nullable), `title`, `type enum('file','link')`, `url_or_path`, `created_at`.

RLS additions: parents read rows only where a `parent_students` link ties them to the `student_id` (sessions, shared session_notes, resources, invoices, bookings for their child). Tutors read/write only their own rows. Unshared session_notes are tutor-only.

### Parent portal look

Same design system (`design-system.md`), lighter nav: Home (next session + latest note), Sessions & Notes, Resources, Schedule, Billing. Calm, parent-friendly, still monochrome.

---

In plain English: this document is the blueprint for the first version of TutorTool. It says the first thing we build is the part that gets tutors paid: set each family's rate, log the lessons (including drive time), send a bill through Stripe, and let the app chase late payments automatically. Everything about receipts, mileage, and taxes comes in a later version so we ship one solid thing first.
