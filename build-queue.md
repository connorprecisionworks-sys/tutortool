# Slate — Build Queue

The autonomous work list. Code works this top-down: build an item fully, /review + /qa, commit, mark it DONE with the commit hash, move to the next. Never git push. Mark BLOCKED items (with why) and keep going. See `slate-loop-prompt.md` for the standing instruction.

Decisions are already baked into each item so no product calls are needed mid-run. Global rules for every item: Slate brand (slate blue accent, Inter Tight headings, per BRAND.md), integer cents for money, RLS so tutors touch only their rows and parents only their child's, page-depth bar (empty/loading/error states, mobile, light+dark), no git push.

Status legend: [ ] todo, [~] in progress, [x] done (+ commit), [!] blocked.

---

## Q1 — Services & pricing model  [x] (5b8eded)

Services table + Settings > Services CRUD; sessions/bookings get optional
service_id, flat price overrides hourly math (travel still additive).
delete_service() blocks deleting a service still in use; dashboard value-given
skips service-priced sessions. Reviewed (high-effort code review found and
fixed a double-booking bug in the booking-duration path) and QA'd end-to-end
(log session against a service -> invoice line bills the flat price).

Foundation for booking and public pages. Tutors offer named, priced services.

- Add `services` (tutor_id, name, description, duration_minutes, price_cents, is_active). Seed each existing tutor with two defaults on migration: "Tutoring session" (uses their standard hourly) and "Diagnostic assessment" (tutor sets price).
- Tutor CRUD for services in Settings, with custom pricing per service. A service price overrides the hourly rate math when a session/booking is tied to that service.
- Sessions and bookings get an optional `service_id`; when set, the line item uses the service price; when not, fall back to the existing rate math.
- Acceptance: a tutor creates a "Diagnostic assessment" at a custom price, books/logs it, and the invoice line uses that price, not the hourly rate.

## Q2 — Native booking link ("send a link, parent picks")  [x] (32f7b82)

/book/TOKEN, no login to view/book. booking_links + booking_link_slots,
get_booking_link_public/confirm_booking_link granted to the anon role
(only fully-anonymous write path in the app). Confirming creates the
client + Student Code inline when the link was left open, and a
`sessions` row directly — no double-entry. Reviewed (high effort; fixed a
deactivated-service-still-billable gap) and QA'd end-to-end via the raw
anon key (bypassing all cookies) plus the full browser flow: 3 slots
offered, booked via a $45 flat-priced service, landed as a logged $45
session with no manual step.

The centerpiece from the tutor process: no back-and-forth, tutor sends dates, parent picks.

- Tutor builds a booking request: pick a student (or leave open for a new parent), pick a service, and select one or more offered date/time slots from their availability. Generate a shareable booking link (tokenized, e.g. /book/TOKEN).
- Parent opens the link (no login required to view), sees the tutor + service + offered slots, picks one, and confirms with name/email. Confirming creates a confirmed booking -> a `sessions` row (so it flows into billing) and links/creates the parent+student as needed.
- Tone and UX modeled on Cal.com's clean single-purpose booking page (study Cal for UX; do NOT integrate Cal, build native).
- Send the tutor a notification on booking (email if Resend set, otherwise in-app).
- Acceptance: tutor offers 3 slots, opens the link in an incognito window as a parent, books one, and it appears as a confirmed session on the tutor side with no double-entry.

## Q3 — Public tutor page (profile + pricing + scheduling)  [x] (d550561)

/t/[handle], no login to view. get_public_tutor_profile() SECURITY DEFINER
(never a public policy on `tutors`); show_bio/show_prices enforced
server-side. "Book" reuses Q2: links to the tutor's newest open+unassigned
booking link, excluding ones with only past slots or a deactivated
service. Reviewed (high effort; fixed a handle-regex bug, a swallowed RPC
error, and deduped the base-URL helper) and manually verified end-to-end
before the fix pass (publish -> page renders services/bio -> Book routes
into the working Q2 flow) plus is_public/show_prices/unknown-handle
checked via the raw anon key. TODO(connor): a standing self-serve
calendar (book any time inside weekly availability, no pre-set slots) is
a reasonable future enhancement — deliberately not built here since it's
a distinct feature from what Q2 shipped, not the polish of the same one.

The "pricing and scheduling pages" + public profile. Doubles as directory-ready later (directory search itself is PARKED).

- Public route /t/[handle] (tutor picks a handle in Settings). Shows tutor name, short bio, subjects, their active services + prices, and a "Book" button that opens the native booking flow (Q2).
- Editorial Slate styling, no login to view, mobile-first, shareable.
- Tutor controls what's public (toggle bio/prices visibility).
- Acceptance: a tutor sets a handle and bio, publishes, and the public page renders their services and a working Book button.

## Q4 — Cancellations (default policy + override)  [x] (45ca1e3)

credits table (SELECT-only + SECURITY DEFINER writes); cancel_session()
resolves override/default/window, issues a rollover credit only when the
session was already paid. create_draft_invoice auto-applies available
credit as its own line item, capped at subtotal, remainder carried
forward; void/delete restore it. Refund is a best-effort Stripe call
capped at the charge's actual remaining refundable balance. Reviewed
(high effort, twice — first pass caught a double-booking-style credit
race + a cancel-blocked-on-draft-invoice bug + an over-refund risk, all
fixed). TODO(connor): browser-level acceptance walkthrough (cancel a paid
session as rollover -> credit reduces next invoice; cancel as refund ->
Stripe call attempted/stubbed) deferred to the end-of-run QA pass per
your instruction not to QA after every item.

Tutor sets a default; overrides per session. Default policy = roll-over credit.

- Tutor setting: default cancellation handling = roll-over credit (default) | refund | charge in full. Plus a cancellation window (e.g. cancel >24h = free, inside = charge), tutor-configurable.
- On cancelling a session: apply the default, with a per-session override to refund, roll over to a credit, or charge. A roll-over creates a `credits` row applied to the next invoice; a refund on a paid session triggers a Stripe refund (behind the Stripe key); a charge keeps the session billable.
- Credits reduce the next invoice total and show as a line. Never let totals go negative silently; cap and carry.
- Acceptance: cancel a paid session as roll-over -> a credit appears and reduces the next invoice; cancel as refund -> a Stripe refund is initiated (or clearly stubbed if no key).

## Q5 — Prepay & packages  [x] (06f3c6e)

packages table (SELECT-only + SECURITY DEFINER writes, tutor + parent
visibility). Prepayment reuses the existing invoice/Stripe pipeline
(create_package builds a normal draft invoice); create_session_with_package
draws the balance down atomically; cancelling restores it on rollover, not
on charge. Pay-before/pay-after as a tutor default + per-invoice field,
'pay_before' forces an immediate due date. Reviewed (high effort; fixed a
real privilege-escalation risk I caught myself before the review even ran
— activate_package_for_invoice was callable directly by any tutor with an
arbitrary invoice_id — plus an RLS gap on sessions.package_id, a missing
payment_timing on package invoices, and a UI papercut where cancelling
offered "Refund" on a package session that silently just restores the
balance). TODO(connor): browser-level acceptance walkthrough (prepay a
4-session package, draw 3, cancel one -> back to 2 remaining) deferred to
the end-of-run QA pass.

From "prepaying for a week or paying before or after."

- Support pay-before and pay-after per invoice/booking (tutor default + per-invoice choice).
- Packages: tutor sells N sessions (or a week block) upfront; parent prepays; sessions draw down the balance; remaining balance visible to both sides. A cancellation on a package restores the session to the balance (ties to Q4 roll-over).
- Acceptance: parent prepays a 4-session package, three sessions draw it to 1 remaining, a cancelled one restores it to 2.

## Q6 — Automatic session reminders (email)  [x] (faf5454)

Extends the existing invoice-reminder engine (table, dedup, templates)
rather than a parallel system: reminders.session_id + kind, partial
unique index for dedup. Booking confirmation sent from Q2's
confirm_booking_link flow specifically (matches spec's "(Q2)" scoping,
not P9's separate flow); upcoming-session reminder from the daily cron
once within the tutor's lead-time setting. Reviewed (high effort; fixed a
real HTML-injection path — anonymous booking-form input reached parent
emails unescaped — plus a claim-before-verify ordering bug, an unbounded
lead-hours setting vs. the cron's 14-day cap, and a timezone
inconsistency). TODO(connor): browser-level acceptance walkthrough
(a session 24h out generates a logged reminder; a new booking generates a
logged confirmation) deferred to the end-of-run QA pass.

Extend the existing invoice-reminder engine to sessions and bookings.

- Booking confirmation email to the parent on booking (Q2).
- Upcoming-session reminder to the parent (tutor-configurable lead time, e.g. 24h before). Reuse the reminders job + templates; log every send.
- Gracefully no-op without Resend (log intent), same pattern as invoices.
- Acceptance: a session 24h out generates a logged reminder; a new booking generates a logged confirmation.

## Q7 — Tutor code + parent-side setup  [x] (915b305)

tutors.tutor_code (column DEFAULT function, not a trigger — kept the
generated Insert type from breaking every existing tutors insert
call-site). redeem_tutor_code creates-or-links a student + inline Student
Code, mirroring Q2's confirm_booking_link pattern; unclaimed-roster
picker requires a real parent account, not just the code. Tutor sees new
parent-created students on the Students page, confirm/merge. Reviewed
(high effort; fixed two missing archived-student checks, a users-row
backfill gap on /join, and a pending-review card leaking onto the
archived tab). TODO(connor): "email confirmation off" needs Supabase
Dashboard access (Authentication > Providers > Email) this environment
doesn't have a safe way to reach — the flow degrades acceptably with
confirmation on, but that's the remaining piece for true "fewest taps."
Browser-level acceptance walkthrough deferred to the end-of-run QA pass.

Add a tutor-level join code alongside the per-student codes (keep student codes working).

- Each tutor has one shareable tutor code / link. A parent who joins via the tutor code lands in a lightweight setup: enter their child's name (or pick from the tutor's unclaimed students), creating the parent+student link. Tutor sees and can confirm/merge new parent-created students.
- Keep per-student codes fully working; this is additive.
- Polish the parent-side account setup so a parent goes from code to a working portal in the fewest taps (email confirmation off).
- Acceptance: a parent joins with the tutor code, adds their child, and the tutor sees the new linked student to confirm.

## Q8 — SMS reminders (research + build, key-gated)  [x] a9cec23 — SMS channel wired into both reminder loops (independent of email, concurrent send), key-gated via lib/sms.ts; no live Twilio account to test the "keys set" branch.

"Look into SMS reminders."

- Add SMS as a reminder channel via Twilio, behind TWILIO_* env keys (same disabled-until-configured pattern as Resend). Tutor + parent opt-in and phone capture with consent language. Reminders (session + invoice) can send by SMS when enabled.
- At the top of the work, drop a short `notes/sms-reminders.md` covering Twilio setup, cost per segment, and A2P 10DLC registration (US SMS compliance) so Connor knows the real-world requirements before turning it on.
- Acceptance: with Twilio keys set, an opted-in parent gets an SMS reminder; without keys, the option is cleanly disabled.

---

# BATCH 2 (next loop)

New todo items. Same global rules and same standing loop prompt (`slate-loop-prompt.md`). Work these top-down after all Batch 1 items (they are done). Decisions are baked in; no product calls needed.

## B1 — Expense, receipt capture & mileage (tax module)  [x] (d8f3a85)

`expenses` table (plain tutor-owned RLS — not a cross-row money state
machine like invoices/packages, so no SECURITY DEFINER layer needed; see
money_mutation_architecture memory for when that pattern IS required).
Receipts follow the exact `resources` (P8) storage pattern: private
`receipts` bucket, no `storage.objects` policies at all, access gated
through the owning row + service-role admin client for I/O and 60s signed
view URLs. Mileage amount_cents is always computed server-side from the
tutor's `mileage_rate_cents` setting (never trusted from the client),
snapshotted onto the row like `sessions.effective_rate_cents` so a later
rate change never rewrites past totals. Insert/update RLS mirrors the FK
ownership checks on both `student_id` and `session_id` (see
rls_insert_update_asymmetry memory). CSV export is hand-rolled (no CSV
library in the repo) via a `/tutor/expenses/export` route handler.
Reviewed (manual pass standing in for the missing gstack review
checklist/bin tooling in this environment — focused on RLS, storage
security, and money math; fixed a delete-ordering gap where a failed
receipt-storage removal would still delete the expense row, orphaning
the file with no reference) and QA'd end-to-end in a headless browser
(supplies expense + receipt upload, mileage trip valued at miles × rate,
year summary totals, CSV export, dashboard tile, empty state, mobile,
dark mode) — found and fixed two real bugs: the receipt "View" link
opened a signed URL asynchronously after a server round-trip, which real
browsers' popup blockers silently drop even on a genuine click gesture
(fixed by opening a blank tab synchronously and pointing it at the URL
once resolved), and the mileage rate hint was missing its "$" prefix.

The original ask from Beth's first meeting: track the deductible business side for tax time. This is the real tax-savings feature (distinct from the "value given" impact number, which is not deductible).

- Add `expenses` (tutor_id, incurred_on, category, amount_cents, vendor, note, receipt_path nullable, student_id/session_id nullable link). Categories: supplies, curriculum, training, mileage, fees, other.
- Receipt capture: upload an image/PDF to a Supabase Storage bucket (private, RLS so only the owning tutor reads it) and attach it to an expense.
- Mileage: log a trip (date, miles, purpose, optional from/to text) and value it at an editable IRS standard mileage rate stored in tutor settings (default it to the current-year IRS rate and let the tutor change it, since it updates yearly). Optionally offer to create a mileage expense from a session's logged travel.
- Year/period summary: totals by category + total mileage deduction, with a CSV export. This is for the tutor's records and their accountant.
- New "Expenses" area in the tutor nav; surface a small year-to-date expenses figure on the dashboard.
- Acceptance: add a supplies expense with a receipt image and a mileage trip; the tax summary totals them by category and the mileage line equals miles times the set rate.

## B2 — Recurring / standing weekly sessions  [x] (pending commit)

`recurring_sessions` is the template only; every occurrence is a normal
`sessions` row (`recurring_session_id` link), so billing/reminders/
invoicing need zero special-casing — proven in QA by bundling a
generated instance into a draft invoice with no code changes. Rate
resolution (`lib/recurring-sessions.ts`) reuses `lib/billing.ts`'s exact
helpers rather than reimplementing in SQL, so generation can never drift
from how a manually-logged session bills. Initial batch generates
synchronously at series creation (immediate UX); a new daily cron
(`/api/cron/generate-recurring-sessions`, added to vercel.json) rolls the
8-week horizon forward for existing series. "This session only" reuses
the existing Q4 cancel_session flow untouched; "this and future" is a
new `end_recurring_series()` SECURITY DEFINER function that halts
generation and cancels remaining unbilled instances via cancel_session
in a loop (skip-on-error per instance so one already-billed session
doesn't block the rest). RLS: recurring_sessions is select+insert-own
only (no update policy — all state changes route through
end_recurring_series); sessions_insert_own tightened to also check
recurring_session_id ownership (same asymmetry-closing pattern as Q5's
package_id). Reviewed (manual pass — same missing-tooling caveat as B1)
and QA'd end-to-end in a headless browser: created a weekly Tuesday 4pm
series, got 8 correctly-dated/priced instances, billed one into a draft
invoice normally, cancelled a single instance (rest stayed intact), then
cancelled "this and future" (correctly swept remaining unbilled
instances including the still-draft one, which recomputed the invoice
to $0, and left the already-billed one alone) — found and fixed a real
bug where ending a series on/before its own start date violated the
`end_date >= start_date` check constraint.

Tutors usually have a fixed weekly slot per student. Stop re-entering it.

- Create a recurring session template (student, service, weekday, time, duration, travel, start date, end date or ongoing). It generates upcoming session instances automatically (rolling horizon, e.g. next 8 weeks).
- Editing/cancelling: choose "this session only" vs "this and future" (series). One-off cancellation uses the Q4 cancellation flow and does not break the series.
- Instances bill and remind exactly like normal sessions; no double-entry.
- Acceptance: set a weekly Tuesday 4pm session for a student; upcoming instances appear and each invoices normally; cancelling one instance leaves the rest intact.

## B3 — Business-insights dashboard  [ ]

The "insights" pillar from the brand sheet. Read-only reporting, no new money mutations.

- An Insights view: revenue this month and this quarter (paid), outstanding (sent/overdue unpaid), booked-but-unbilled (upcoming income), sessions taught and hours, top students by revenue, and value given. Simple Slate-styled charts plus headline numbers.
- All figures derived from existing tables; must reconcile to the penny with the underlying data.
- Acceptance: every headline number matches a hand calculation against seeded data.

## B4 — Standing self-serve booking  [ ]

The Q3 TODO: let parents book any open time inside availability, not just pre-set slots (Calendly-style), as a booking option the tutor can enable.

- On the public tutor page / booking flow, add a mode where a parent picks any open slot inside the tutor's weekly availability, respecting existing sessions and a configurable buffer, and it auto-confirms into a `sessions` row.
- Tutor chooses per booking link (or globally) between "offer specific slots" (existing Q2) and "open availability" (this).
- Reuse the anon-safe booking path and its ownership/no-double-book guards from Q2; do not weaken RLS.
- Acceptance: a parent books an arbitrary open slot inside availability and it confirms as a session; an already-taken or out-of-availability time is not offered.

## B5 — Calendar sync (iCal feed)  [ ]

Keyless calendar sync so a tutor sees Slate sessions in Google/Apple/Outlook. (Decision: ship the iCal subscribe feed now; full Google two-way OAuth sync is a later item, not this one.)

- Generate a per-tutor secret iCal feed URL (tokenized, unguessable) that serves the tutor's upcoming sessions as a standard .ics feed the tutor subscribes to. Read-only, one-way (Slate -> calendar).
- Include session title (student + service), time, duration, and location. Refreshes as bookings change.
- Settings shows the feed URL with copy + a regenerate (revoke) option.
- Acceptance: subscribe to the iCal URL in a calendar app and Slate sessions appear; a new booking shows up on the calendar's next refresh; regenerating the URL invalidates the old one.

## B6 — Hardening + polish + deferred QA  [ ]

Lock down what shipped. No new features.

- Complete the browser-level acceptance walkthroughs deferred in Batch 1 (Q4 cancellations: rollover credit reduces next invoice, refund path attempted/stubbed; Q5 packages: prepay draws down, cancel restores). Report results.
- Resolve or document every outstanding // TODO(connor) marker.
- Fix the pre-existing <img> lint warnings in components/brand/logo.tsx (use next/image) and any other lint noise.
- Page-depth audit pass on the newest surfaces (services, booking link, public tutor page, packages, cancellations, expenses, insights): empty/loading/error states, mobile, light+dark.
- Acceptance: deferred QA walkthroughs done and reported, lint clean, TODO markers resolved or clearly documented.

---

## Parked (do NOT build in this loop)

- Searchable "find tutors in your area" directory / marketplace + matching. Public tutor pages (Q3) make this possible later, but the directory, search, and tutor discovery are a separate initiative.

## Housekeeping (do when convenient, not blocking)

- The uncommitted PostHog analytics in the working tree: leave it alone unless Connor commits/stashes it. Do not build on top of it.
