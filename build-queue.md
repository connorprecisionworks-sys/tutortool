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
checked via the raw anon key. TODO(connor) RESOLVED by B4: a standing
self-serve calendar (book any time inside weekly availability, no
pre-set slots) is now built — see the B4 entry below.

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
inconsistency). Walkthrough done in B6: logged a session ~24h out for a
student with a payer email, manually triggered the reminders cron
(CRON_SECRET), confirmed `sessionRemindersSent: 1` and a matching row in
`reminders`. (Booking confirmations were already independently verified
firing during B4's QA of the new booking flow.)

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
archived tab). TODO(connor) walkthrough done in B6: parent joined via
tutor code -> "Someone else, add their name" -> Join, landed straight in
the parent portal with no email-confirmation prompt at all in this dev
project (the earlier assumption that Dashboard access was needed to turn
confirmation off turned out to be wrong for this Supabase project's
actual configuration — worth re-checking Auth settings before assuming
it's still an open item) -> confirmed on the tutor's Students page via
the "New from parent signups" card.

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

## B2 — Recurring / standing weekly sessions  [x] (6e259a2)

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

## B3 — Business-insights dashboard  [x] (5df1ea1)

Read-only — no migration, no new mutations. Headline numbers are either
the already-authoritative `invoices.total_cents` (never recomputed here,
just summed/filtered) or run through the exact same `computeSessionAmountCents`/
`computeValueGivenCents` helpers the rest of the app already uses for
billing and the dashboard's value-given card, so there's no second
implementation of the money math to drift from the first. "Booked, not
yet billed" mirrors `create_draft_invoice`'s own eligibility filter
(logged, not cancelled, no package, not yet invoiced) plus a
future-only date filter, so the number matches what would actually
appear if invoiced today. Simple CSS bar charts (no charting library
added — none existed in the repo). QA'd with real seeded data (a $60
paid session this month, a $40 future unbilled session, standard rate,
no discounts): every headline number, the 6-month revenue bar, and the
top-students bar matched hand math exactly on the first pass. Checked
light/dark and mobile.

The "insights" pillar from the brand sheet. Read-only reporting, no new money mutations.

- An Insights view: revenue this month and this quarter (paid), outstanding (sent/overdue unpaid), booked-but-unbilled (upcoming income), sessions taught and hours, top students by revenue, and value given. Simple Slate-styled charts plus headline numbers.
- All figures derived from existing tables; must reconcile to the penny with the underlying data.
- Acceptance: every headline number matches a hand calculation against seeded data.

## B4 — Standing self-serve booking  [x] (257ad1a)

booking_links gets a `mode` ('fixed_slots' | 'open_availability'). An
open_availability link is genuinely standing/reusable (Calendly-style —
stays status='open' and gets booked repeatedly by different parents,
unlike a fixed_slots link which is single-use), which meant it couldn't
reuse Q2's booking_links.session_id/chosen_slot_id (built for a 1:1
link->booking model) — tracked instead via a new nullable
sessions.booking_link_id. Deep-researched the existing Q2/P9 booking
architecture before writing any code (see the exploration in this
session) and found a real, pre-existing gap: confirm_booking_link (Q2)
had NO overlap check against anything, and P9's create_booking/
approve_booking only checked overlap against other `bookings` rows — the
two mechanisms couldn't see each other, so a tutor could already be
double-booked across a booking link and a P9 request today. Closed this
with one shared `is_slot_bookable()` (containment against `availability`
+ overlap-with-buffer against BOTH `sessions` and `bookings`, under the
same per-tutor `pg_advisory_xact_lock` P9 already uses for this exact
race class) used by both the new public day-slots RPC and the confirm
function, so there's exactly one implementation of "is this tutor free"
to keep correct. get_public_tutor_profile (Q3) widened to also surface
a standing link on the public page's "Book" button — it previously
required a future `booking_link_slots` row, which an open_availability
link never has. Reviewed (manual pass, same missing-tooling caveat as
B1/B2 — caught and fixed a genuine SQL syntax bug myself, a missing
semicolon in the token-retry loop, before ever applying the migration;
also directly SQL-tested is_slot_bookable's containment/overlap/buffer/
past-date logic in isolation against a real fixture before building any
UI on top of it) and QA'd end-to-end in a headless browser: created a
standing link, confirmed the public page correctly excluded both
out-of-availability times and a time already occupied by an existing
session, booked it twice with two different parents (proving it's
genuinely reusable, not single-use), verified both sessions billed
correctly, confirmed the public tutor profile's "Book" button now
routes to the standing link, and confirmed cancelling the link stops
further bookings on both the tutor and public sides.

The Q3 TODO: let parents book any open time inside availability, not just pre-set slots (Calendly-style), as a booking option the tutor can enable.

- On the public tutor page / booking flow, add a mode where a parent picks any open slot inside the tutor's weekly availability, respecting existing sessions and a configurable buffer, and it auto-confirms into a `sessions` row.
- Tutor chooses per booking link (or globally) between "offer specific slots" (existing Q2) and "open availability" (this).
- Reuse the anon-safe booking path and its ownership/no-double-book guards from Q2; do not weaken RLS.
- Acceptance: a parent books an arbitrary open slot inside availability and it confirms as a session; an already-taken or out-of-availability time is not offered.

## B5 — Calendar sync (iCal feed)  [x] (9e56ab7)

Per-tutor `ical_token` (128-bit random, same entropy as booking_links'
tokens — not the short hand-typed tutor_code, since this lives in a URL
a calendar app polls unattended). Public read goes through a
SECURITY DEFINER RPC (get_ical_feed) returning JSON, same shape as
get_booking_link_public/get_public_tutor_profile, rather than the route
handler reaching for the admin client directly — keeps every anonymous
read in the app on one reviewed pattern. Regenerate is a fresh random
token; the old URL 404s immediately since nothing can find a tutor by a
token that no longer exists. Reviewed (manual pass, same missing-tooling
caveat as B1/B2/B4) and QA'd end-to-end — found and fixed two real bugs
before this could be called done: (1) the proxy/middleware's public-path
allowlist didn't include /api/ical, so every request 307-redirected to
/login — a calendar app has no session cookie to redirect with, so the
feed would have silently never worked; (2) a genuine SQL bug caught by
direct RPC testing, not just app-level testing — the query mixed an
outer ORDER BY/LIMIT with an ungrouped json_agg aggregate, which
PostgreSQL rejects outright (42803), not just handles wrong; fixed by
moving the filter/order/limit into a subquery. After both fixes:
subscribed via curl, confirmed a well-formed, correctly-escaped .ics
with accurate DTSTART/DTEND and LOCATION; logged a second session and
confirmed it appeared on refetch with no extra step; regenerated the
link and confirmed the old URL 404s while the new one serves
immediately. Checked Settings UI in light/dark and mobile.

Keyless calendar sync so a tutor sees Slate sessions in Google/Apple/Outlook. (Decision: ship the iCal subscribe feed now; full Google two-way OAuth sync is a later item, not this one.)

- Generate a per-tutor secret iCal feed URL (tokenized, unguessable) that serves the tutor's upcoming sessions as a standard .ics feed the tutor subscribes to. Read-only, one-way (Slate -> calendar).
- Include session title (student + service), time, duration, and location. Refreshes as bookings change.
- Settings shows the feed URL with copy + a regenerate (revoke) option.
- Acceptance: subscribe to the iCal URL in a calendar app and Slate sessions appear; a new booking shows up on the calendar's next refresh; regenerating the URL invalidates the old one.

## B6 — Hardening + polish + deferred QA  [x] (a5f9a09)

**Deferred walkthroughs, all done in a real browser this pass:**
- Q4 cancellations: cancelled a paid session as rollover -> a $40 credit
  appeared and fully offset a new $40 invoice to $0.00; cancelled a
  second paid session as refund -> "Cancelled — refunded" with no error
  (Stripe unconfigured, so the best-effort call cleanly no-ops, per spec).
- Q5 packages: prepaid a 4-session $150 package -> invoice auto-built and
  paid -> package went Active 4/4 -> drew 3 sessions against it -> 1/4 ->
  cancelled one of the drawn sessions as "Restore to the package" -> 2/4,
  exactly matching the acceptance line.
- Q6 reminders: logged a session ~24h out for a student with a payer
  email, ran the cron manually, got `sessionRemindersSent: 1` and a
  matching logged row.
- Q7 parent join: joined via tutor code, added a new child, landed
  straight in the parent portal (no email-confirmation gate hit in this
  project — see the Q7 TODO update above), tutor saw and confirmed the
  new student on the Students page.

**Real bug found and fixed along the way:** a *billed* (paid) session
had no link back to its own detail page from the Sessions list — the
date was only ever a `<Link>` when `status === 'logged'` or cancelled —
so "cancel a paid session," Q4's whole premise, was reachable in the
database/RPC layer but a genuine dead end in the UI. Every row now
links, billed included; the detail page itself already handled every
status correctly, it just needed to be reachable.

**Lint/polish:** `components/brand/logo.tsx`'s `<img>` warnings fixed
with `next/image` (intrinsic width/height taken from each SVG's
viewBox so the existing height-only `className` sizing keeps working
via the browser's implicit aspect-ratio, unchanged visually — verified
across the marketing header/footer, app shell sidebar, and every
auth/public-page usage). Also needed `images.dangerouslyAllowSVG` +
a locked-down `contentSecurityPolicy` in next.config.ts, since Next's
image optimizer 400s on any SVG by default. `npm run lint` is now 0
warnings, 0 errors (previously 4 warnings, all from this file).

**TODO(connor) sweep:** every marker in the codebase was reviewed (see
the full list gathered via `grep -rn "TODO(connor)"`). Two were stale
and updated in place (Q3's self-serve-calendar TODO — resolved by B4;
Q7's email-confirmation TODO — turned out not to be blocking in this
project's actual config, corrected above). The rest (Stripe/Twilio/
Resend "unexercised, no live key" notes; the single-timezone MVP
assumption; the professional_discount rate-storage tradeoff; P6/P8/P9
spec-vs-actual naming notes) are already accurate, load-bearing
documentation of deliberate scope decisions with their reasoning
inline — nothing left silently undocumented.

**Page-depth spot checks this pass:** Packages (empty state), Services
(empty state, light/dark, mobile), Booking Links + public tutor page
(light/dark/mobile, covered fully during B4's QA), cancellations (light/
dark, covered via the Q4 walkthrough above) — no new issues beyond the
dead-end bug already covered above.

Lock down what shipped. No new features.

- Complete the browser-level acceptance walkthroughs deferred in Batch 1 (Q4 cancellations: rollover credit reduces next invoice, refund path attempted/stubbed; Q5 packages: prepay draws down, cancel restores). Report results.
- Resolve or document every outstanding // TODO(connor) marker.
- Fix the pre-existing <img> lint warnings in components/brand/logo.tsx (use next/image) and any other lint noise.
- Page-depth audit pass on the newest surfaces (services, booking link, public tutor page, packages, cancellations, expenses, insights): empty/loading/error states, mobile, light+dark.
- Acceptance: deferred QA walkthroughs done and reported, lint clean, TODO markers resolved or clearly documented.

---

# BATCH 3 (platform changes from Connor's notes, 2026-07-16)

These refine earlier decisions. Same loop, same rules. Order matters (onboarding + availability before booking rework, polish last).

## C1 — Hard onboarding gate (replaces the dismissible checklist)  [x] (556db08)

Full-screen 5-step wizard at /onboarding (rate, availability [C2],
service, handle+bio, optional student+invite), gated in
app/tutor/layout.tsx via a tutor-scoped session cookie so an
already-set-up tutor skips the extra queries and an incomplete one
gets bounced every render until they finish or skip through. Reused
existing server actions per step rather than duplicating them.
Dashboard's OnboardingChecklist redesigned to keep showing a small
reminder for skipped *optional* items (student, Stripe) even once
required steps are satisfied, per spec — it previously hid entirely
the moment required was done. Reviewed + QA'd in a headless browser
(see the C1 commit for the full writeup); found and fixed a real bug
myself before commit where the gate cookie wasn't scoped to the
tutor, letting a second tutor signing up in the same browser tab
inherit the first tutor's cleared gate. TODO(connor): existing
pre-C1 tutors without a public handle will hit the gate once on
their next visit to pick one — correct per spec, but worth knowing
before deploy.

Onboarding becomes the first thing a tutor does, gating the dashboard, not an optional card.

- On first login (and any time required setup is incomplete), route the tutor into a full-screen, focused, multi-step setup flow instead of the dashboard. Steps: set standard rate + travel rule, set weekly availability (see C2), add at least one service, set public handle + bio, (optional) add first student + send invite.
- Include a subtle "Skip for now" on each step so it's not a hard lock, but the flow is the default landing until required steps are done, and it re-appears next login while incomplete. Once complete, it never gates again.
- Keep a small dashboard reminder for anything skipped. Retire the old dismissible-only behavior as the primary onboarding.
- Acceptance: a brand-new tutor lands in the gated setup, not the dashboard; completing it (or skipping to the end) opens the dashboard; a returning tutor with setup incomplete is routed back into it.

## C2 — Weekly availability editor  [x] (91dfabf)

Extended the existing per-day AvailabilityManager (P9) with a weekday
checkbox picker + Mon-Fri/Weekends/Every day quick-selects; one submit
inserts a row per selected day, de-duped against identical existing
windows. Removal stays per-window (delete + re-add, no update policy,
per P9's original design — "edit" is remove-then-re-add). Reused
directly by C1's onboarding wizard step. QA'd via headless browser as
part of C1's flow below (applying Mon-Fri 3-6pm produced exactly 5
rows, each independently removable).

Set availability as recurring weekly blocks, fast.

- A tutor sets availability by day-of-week + time range, and can apply a range across multiple days in one action (e.g. Mon-Fri, 3:00-6:00pm). Support multiple blocks per day and easy add/remove/edit. This is the single source of truth for when the tutor is bookable.
- Builds on the existing `availability` table; extend as needed. Times respect the app's existing time handling (note the standing UTC/timezone TODO).
- Acceptance: a tutor sets Mon-Fri 3-6pm in one action and it saves as the weekly availability that booking reads from.

## C3 — Availability-driven booking (services inherit availability)  [x] (b73516c)

Public page's booking CTA is per-service and needs no tutor-created
booking link first: new (get_public_service, get_public_service_slots,
confirm_public_service_booking) RPCs key off (handle, service_id)
directly, deliberately not built on B4's booking_links (would mean
auto-creating an invisible link per service). B4's manual link stays a
quiet secondary CTA. Reuses B4's is_slot_bookable() + advisory lock.
High-effort review (real, not the missing-tooling manual-pass caveat
from Batch 2 — gstack /review is available now) caught and fixed
three real bugs before commit: a race where fast date-switching could
book a slot from the wrong day, a failed-confirm leaving a just-taken
slot resubmittable forever, and a swallowed RPC error masking outages
as 404s — plus deduped a copy-pasted SQL slot-generation loop into a
shared helper. The same race+stale-slot fix was also backported to
B4's own booking form, which had the identical bug. QA'd end-to-end
(Mon-Fri 3-6pm + 60-min service → exactly 3 slots; booking one removes
it on reload; the "slot taken from under you" fix verified by racing
the anon RPC directly against an open picker).

Services no longer carry their own fixed time slots. Bookable times are generated from the tutor's availability, filtered by the chosen service's duration, minus existing sessions and a buffer. This makes availability the model (Cal-style), building on B4's open-availability booking.

- Public page / booking flow: parent picks a service, then sees open times computed from the tutor's weekly availability for that service's length, and books one, creating a session.
- Make availability-driven booking the default/primary path. Keep the manual "offer specific slots" booking link as an optional secondary override, not the default; a service by itself never defines times.
- Reuse B4's is_slot_bookable() + per-tutor lock so nothing double-books.
- Acceptance: with Mon-Fri 3-6pm availability and a 60-min service, a parent booking that service sees only open 60-min slots inside 3-6pm on weekdays, and a booked time disappears from the options.

## C4 — Customizable public/booking page  [x] (c189b08)

Photo, display name, headline, welcome note, custom booking-button
label, and service order (up/down on the Services page), with a live
preview pane in Settings mirroring the real page as fields change —
Slate frame/typography untouched, content + arrangement only.
High-effort review caught and fixed two real security bugs before
commit: a path-traversal risk in the avatar upload path (built
entirely from server-generated values now, never the client
filename) and a stored-XSS risk from accepting image/svg+xml
(restricted to a raster allowlist — verified a crafted SVG is
rejected while a real PNG uploads and renders publicly). Also fixed:
a non-atomic multi-row reorder loop (replaced with a single
SECURITY DEFINER move_service() transaction), new services no longer
defaulting to sort_order 0 (a DB trigger auto-assigns append-at-end),
and reorder errors that were silently swallowed by the UI. QA'd
end-to-end in both themes and at 390px.

Let each tutor customize their public page so it isn't a generic clone. Cal-inspired setup UX, Slate brand frame kept.

- Tutor can customize content and arrangement: profile photo, display name, headline/tagline, bio, subjects, which services appear and their order, show/hide prices, a short welcome note, and the booking CTA label. Live preview while editing.
- Decision (baked): customization is content + layout arrangement, NOT full color re-theming. Keep Slate typography and the slate-blue accent so pages stay consistent and premium. (Connor can expand to theming later if he wants.)
- Acceptance: a tutor uploads a photo, writes a headline, reorders services, hides prices, and the public page reflects all of it with the Slate frame intact.

## C5 — Motion + mobile polish pass (landing + dashboard)  [ ]

Do this LAST, after C1-C4, so it polishes the final state. Full spec is the same as the motion/mobile prompt: premium staggered entrance/reveal/fly-in animations on the landing (transform+opacity only, IntersectionObserver, reduced-motion safe), smooth marquee, and a genuine mobile optimization of the landing AND the tutor dashboard + core screens (drawer nav, tables to cards/scroll, no overflow, 44px targets, both themes). Verify with screenshots at 390px and 1440px, light and dark; iterate on what looks off rather than stopping at a green build.

Note: a landing-page motion rebuild (hero stagger, parallax, marquee fade, alternating reveals) and an initial dashboard mobile-responsiveness pass (tables, tap targets, settings wrap) already shipped outside the queue in commits `33f1586`/`c274a09`/`f26bc8b`/`f8a4d01`. When this item comes up, audit what's already covered before redoing it — this pass should mainly extend the same treatment to whatever C1-C4 add (onboarding flow, availability editor, customizable public page) rather than starting from scratch.

- Acceptance: landing motion is smooth and tasteful (not busy), reduced-motion gives static content, and the dashboard is clean and usable at 390px in both themes.

---

## Parked (do NOT build in this loop)

- Searchable "find tutors in your area" directory / marketplace + matching. Public tutor pages (Q3) make this possible later, but the directory, search, and tutor discovery are a separate initiative.

## Housekeeping (do when convenient, not blocking)

- The uncommitted PostHog analytics in the working tree: leave it alone unless Connor commits/stashes it. Do not build on top of it.
