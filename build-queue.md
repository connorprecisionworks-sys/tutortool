# Slate — Build Queue

The autonomous work list. Code works this top-down: build an item fully, /review + /qa, commit, mark it DONE with the commit hash, move to the next. Never git push. Mark BLOCKED items (with why) and keep going. See `slate-loop-prompt.md` for the standing instruction.

Decisions are already baked into each item so no product calls are needed mid-run. Global rules for every item: Slate brand (slate blue accent, Inter Tight headings, per BRAND.md), integer cents for money, RLS so tutors touch only their rows and parents only their child's, page-depth bar (empty/loading/error states, mobile, light+dark), no git push.

LEGAL DOCS RULE (standing): if an item introduces a new type of data collected, a new third-party service provider/subprocessor, a new way data is shared, or a public-facing surface, you MUST also update /terms and /privacy (source: legal/Slate-Terms-of-Service.md and legal/Slate-Privacy-Policy.md), bump the Effective Date + version, and add a dated line to legal/legal-changelog.md. Legal docs must stay in sync with what the app actually does.

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

## C5 — Motion + mobile polish pass (landing + dashboard)  [x] (c21417b)

Audited what already shipped (landing motion + initial dashboard
mobile pass, commits 33f1586/c274a09/f26bc8b/f8a4d01) rather than
redoing it, then extended the same treatment to what C1-C4 actually
added: onboarding wizard steps now fade+rise in (motion-safe:-gated,
matching the landing page's Reveal primitive's reduced-motion
convention). Screenshot pass at 390px/1280px, light+dark, across the
onboarding wizard, the C1 dashboard reminder card, and the Services
list surfaced one real bug (not new work from this item, but exactly
the kind of thing this pass exists to catch): C4's reorder-button
column was the table's first cell, which the app's responsive-table
CSS always makes the mobile card's bold title — so a service's card
was titled by two icon buttons instead of its name. Fixed by moving
the reorder buttons inline beside the name instead of a separate
column.

Do this LAST, after C1-C4, so it polishes the final state. Full spec is the same as the motion/mobile prompt: premium staggered entrance/reveal/fly-in animations on the landing (transform+opacity only, IntersectionObserver, reduced-motion safe), smooth marquee, and a genuine mobile optimization of the landing AND the tutor dashboard + core screens (drawer nav, tables to cards/scroll, no overflow, 44px targets, both themes). Verify with screenshots at 390px and 1440px, light and dark; iterate on what looks off rather than stopping at a green build.

Note: a landing-page motion rebuild (hero stagger, parallax, marquee fade, alternating reveals) and an initial dashboard mobile-responsiveness pass (tables, tap targets, settings wrap) already shipped outside the queue in commits `33f1586`/`c274a09`/`f26bc8b`/`f8a4d01`. When this item comes up, audit what's already covered before redoing it — this pass should mainly extend the same treatment to whatever C1-C4 add (onboarding flow, availability editor, customizable public page) rather than starting from scratch.

- Acceptance: landing motion is smooth and tasteful (not busy), reduced-motion gives static content, and the dashboard is clean and usable at 390px in both themes.

---

# BATCH 4 (tutor feedback from first live session, 2026-07-18)

Real feedback from Connor's first tutor. Same loop, same rules, same LEGAL DOCS RULE. Ordered quick-wins/foundational first, bigger + infra-dependent later. Items needing an external key/account (Resend, Google/Outlook/Zoom OAuth) should build the code and mark themselves [!] blocked on the missing credential rather than stalling.

## D1 — Onboarding handle: validate live + allow anything  [x] (5dfc098)

Live format/reserved checks are instant (lib/handle.ts, shared with the
save action so they can never drift); availability is debounced against
a new is_handle_available() SECURITY DEFINER RPC (tutors_select_own RLS
blocks a plain cross-tutor lookup otherwise). Submit is disabled with an
inline message for taken/invalid; a transient check failure never blocks
submit. Format relaxed to letters/digits/hyphens/underscores/periods,
3-48 chars (kept the 3-char floor — a prior fix had deliberately closed
a 1-char-handle bug); added a reserved-handle list over the app's real
top-level routes. Reviewed (high effort; fixed a real bug where the live
check called the full requireTutor() gate and could redirect a tutor off
the page mid-keystroke, plus a regex draft that reintroduced the 1-char
bug) and QA'd end-to-end across two disposable tutors: invalid format,
reserved word, cross-tutor taken handle, and a valid custom handle with
underscore/period, in both onboarding and Settings, light+dark, desktop
+mobile.

- On the onboarding + settings handle field, validate inline BEFORE submit: show availability/format feedback as they type (taken/available, allowed characters), and block submit only with a clear inline message, never a silent fail.
- Relax handle rules so it can be almost anything the tutor wants (any URL-safe string, reasonable length); only reject truly invalid/taken handles.
- Acceptance: typing a taken or invalid handle shows an inline flag immediately; a valid custom handle submits cleanly.

## D2 — Dashboard "Getting Started / Learn Slate"  [x] (4912145)

Dismissible "Learn how to use Slate" card above the existing setup
checklist: 4 steps (add a student, set availability, send a booking
link, invoice) each linking to the real action. Distinct dismiss state
from the checklist (own localStorage key) so it stays useful as a
standing orientation even after required setup is done, not just for
brand-new accounts. No money/Stripe/RLS/auth/email/public-route surface
touched, so skipped the heavy /review per the loop's own scoping rule;
QA'd end-to-end in a headless browser (renders alongside the checklist,
dismiss persists independently, each link navigates correctly,
light+dark, desktop+mobile).

Tutors land on the dashboard and don't know what to do. Add an intro.

- A clear "Learn how to use Slate" / getting-started element on the dashboard: a short, dismissible intro card or a help panel with a few "here's how Slate works" steps (add a student, set availability, send a booking link, invoice). Link each to the real action. Calm, editorial, on-brand.
- Acceptance: a new tutor sees an obvious intro/how-to on the dashboard that orients them and links to the key actions.

## D3 — Tutor contact info  [x] (094768c)

Phone field in Settings + a "Show my phone number" public-page toggle
(defaults hidden, unlike show_bio/show_prices, since a phone is more
sensitive). get_public_tutor_profile extended to return it only when
enabled. High-effort review caught and fixed three real bugs: a silent
30-char server-side truncation with no client limit/feedback, a
checked-vs-disabled staleness bug on the visibility checkbox (clearing
phone via the sibling settings form on the same page, no reload, could
leave it checked-and-disabled — unclickable, and silently dropped from
the next submit since native HTML never submits disabled fields, which
would've flipped show_phone to false without the tutor touching it),
and a hand-duplicated status-union type on the D1 handle-check hook
with no compile-time tie to the server action's result type. QA'd
end-to-end (phone saves/persists, toggle starts disabled with no
phone, public page shows/hides exactly per the toggle verified via
both the raw DB row and the rendered page, light+dark, desktop
+mobile) including the specific stale-checkbox repro, confirmed fixed
via direct DOM inspection.

- Add tutor contact fields (phone, and any contact info) in Settings, and optionally surface on the public page (tutor-controlled visibility). Also used to prefill SMS/contact features later.
- Acceptance: a tutor saves a phone/contact, and it persists and can be shown/hidden on the public page.

## D4 — Date format M/D/Y app-wide  [x] (2757e5d)

Full sweep (agent-assisted inventory) of every raw/inconsistent date
render: sessions, invoices, expenses, recurring sessions, parent
portal, reminder emails were showing literal ISO "2026-07-19" with no
formatting. New lib/date.ts (formatDate for plain `date` columns,
formatTimestampDate for timestamptz) applied app-wide; a migration
also fixes invoice line-item descriptions ("Session on Jul 05, 2026"
→ "7/5/2026"), generated server-side in SQL. Left untouched on
purpose: date-input values, formatBookingWhen's weekday format, CSV
export. Reviewed (high effort, twice) and fixed real bugs both passes
— see D1's entry for the first pass (folded in here since it landed
before this item started); this pass caught formatTimestampDate
resolving via the server's local timezone in SSR instead of a pinned
one (could show a different calendar date per deploy environment, and
would have caused a hydration mismatch on the one client-component
call site), fixed by pinning UTC everywhere. Also deduped a
tripled localStorage dismiss-store pattern into
lib/hooks/use-dismissible.ts and a doubled handle-availability hint
into components/settings/handle-check-hint.tsx. QA'd end-to-end
(sessions/expenses lists, a full draft→sent→paid invoice cycle
including the regenerated line-item description, both dashboard
dismiss cards + the announcement bar all independently
dismiss/persist correctly after the refactor), light+dark,
desktop+mobile.

- Change the sessions page (and other date displays) to M/D/Y format for consistency. Sweep the app for inconsistent date rendering and standardize.
- Acceptance: sessions and key screens show dates as M/D/Y.

## D5 — Notes clarity: private vs shared + student intake template  [x] (aad1cf9)

Relabeled per spec's own naming: "Tutor Notes" (sessions.notes,
clients.notes — always private, no sharing mechanism exists) vs
"Session Notes" (session_notes table — shareable, RLS-gated). New
PrivacyPill marks each field's state, live-updating on the Session
Notes toggle. Student detail gets a "Student intake" section grouping
existing payer contact fields with a new structured needs_goals field.
High-effort review found and fixed six real bugs, three from this
item and three resurfacing from D1/D4 in the same review pass: a
server-side reserved-handle re-check with no unchanged-value bypass
that could block saving any profile field for a tutor who already
owned a now-reserved handle; D4's UTC-pinned date formatter shifting
join/invite dates a day for viewers west of UTC on one client
component; RESERVED_HANDLES blocking valid handles like "book"/"join"
that can never actually collide with /t/[handle] (fixed the list and
its inaccurate justification comment); a cross-tab localStorage sync
regression in D4's useDismissible refactor; a PrivacyPill margin
Tailwind's cascade made impossible to override; and misleading Session
Notes copy on billed/cancelled sessions. QA'd end-to-end including
confirming via the raw DB and the actual parent portal that a shared
Session Note appears while the private Tutor Note never does, plus the
reserved-handle-unchanged and "book"-now-valid fixes. Light+dark,
desktop+mobile.

Make it obvious who a note is for, and add a structured student-info template.

- Clearly separate and label "Tutor Notes" (private, never shown to parents/students) from "Session Notes" (shareable with the parent). Rename/relabel and visually distinguish so a tutor never confuses them.
- On the student detail page, add an intake template for the student's parent info, contact, and needs/goals (structured fields or a prefilled note template).
- Acceptance: private tutor notes are clearly marked and never visible in the parent portal; a student has a parent-info/contact/needs section.

## D6 — Parent billing: view all invoices  [x] (8b4c7fa)

The existing architecture already showed every non-draft invoice
across all linked children (no single-invoice restriction anywhere) —
verified via a seeded parent linked to 2 children with 4 invoices
across different statuses, all showed correctly list+detail. Added
what was actually missing for parity with the tutor's own list: status
filter tabs (All/Sent/Overdue/Paid/Void) and a visible Due date on
both the list and detail page, plus brought the table onto the app's
responsive mobile pattern it had never used. High-effort review found
no bugs in the new code but flagged real cross-item cleanup debt from
this batch, fixed now: extracted StatusFilterTabs (shared by tutor +
parent invoice lists), DismissButton (was hand-copied across 4
components even after D4 consolidated the dismiss state hook), and a
generic Pill (PrivacyPill's doc comment claimed it reused the
checklist's "Optional" tag styling but never actually shared code with
it); fixed D6's own date-locale gap (missing "en-US" pin, would've
shown DD/MM/YYYY on non-US browsers); removed a redundant auth
round-trip in D1's live handle-check action. QA'd end-to-end including
confirming a draft invoice never appears to a parent, each filter tab,
Due/Was-due rendering, and that the refactored shared components still
behave identically. Light+dark, desktop+mobile.

- Ensure a parent can view their invoices (list + detail) from the billing section of their portal, not just a single linked one.
- Acceptance: a parent opens Billing and sees all their invoices with status and can open each.

## D7 — Printable / PDF invoices  [x] (d3e5a48)

Browser-native print/save-as-PDF (no new rendering dependency) via a
standalone /invoice/[id] route (no dashboard chrome), a "Print / Save
as PDF" button, and a new get_invoice_document() SECURITY DEFINER RPC
that does its own tutor-or-linked-parent authorization check (a parent
has no RLS grant to read `tutors` directly for the branding info the
document needs). "Download PDF" links added on both tutor and parent
invoice detail pages. High-effort review found and fixed 5 real
issues: a genuine privacy gap where changing a tutor's phone in
Settings never reset show_phone, so a brand-new number could be
silently republished from an old opt-in (now resets on any phone
change, matching the client payer_phone/sms_opt_in re-consent
pattern); a misleading "Due" line shown on already-paid/voided
invoices; a swallowed RPC error rendering as a generic un-logged 404;
a duplicated status-label lookup (now shared with StatusDot); and a
resurfaced D4 gap — the date-format migration never backfilled old
line-item description text, fixed via a new idempotent backfill
migration. Also caught and fixed a real mobile bug during QA (From/
Billed-to grid not collapsing below sm, overlapping long emails at
390px). QA'd end-to-end including an actual generated PDF, a 404 for
an unrelated tutor, and direct-DB verification of the phone re-consent
and Due-line fixes. Desktop+mobile, both themes on the surrounding
chrome (document itself always renders as a fixed white page).

- Add "Download PDF" / printable view for an invoice (tutor and parent). Clean, branded, itemized.
- Acceptance: an invoice downloads as a well-formatted PDF that matches the on-screen invoice.

## D8 — Packages upgrade  [x] `a8e745a`

Packages can be general (client_id now nullable — usable by any student,
activates immediately with a full balance, no invoice, since there's no
single payer to bill) or student-specific (unchanged draft-invoice ->
pending_payment -> active-on-paid flow). The builder computes price from a
selected service or a custom per-session rate × session count, supports a
percent/amount discount with a live-updating total, and a general package
can be toggled onto the public tutor page (`/t/[handle]`) — enforced with
a DB CHECK that only a general package can ever be public, and the
`packages_select_parent` RLS policy updated so a parent can never see a
general package (it isn't their family's purchase). xhigh review found and
fixed 16 real issues, most severe a cluster of 3 billing-correctness bugs:
the package form defaulted the student picker to "general" (silently
skipping invoicing) and the percent-discount field defaulted to a
non-zero 10%, both now default safely (real student pre-selected when one
exists, discount starts empty); session-form.tsx left a stale
package/service selection after switching students, which could silently
downgrade an intended package-draw session to hourly billing — now reset
on student change. Also fixed: general packages were invisible on a
student's own detail page despite being drawable against (now shown,
labeled "General — shared"); a depleted package could be toggled public
with no error while never actually appearing on the public page (which
only shows active packages) — now blocked at the RPC layer and hidden in
the UI once non-active; the public toggle silently reverted on failure
with no visible error and never resynced across tabs/refreshes (fixed via
error display + key-based remount); a deleted custom-price validation
regressed to a misleading error message; total_sessions had no upper
bound (int overflow risk, capped at 365); two number inputs snapped to 0
mid-edit (now string-backed); and `revalidatePath` was invalidating every
tutor's public page instead of just the acting tutor's. QA'd end-to-end
across two fresh tutor accounts: general 4-session package with a 10%
discount (live total $200→$180, appears on `/t/<handle>`, disappears when
toggled off), a student-specific package still builds a draft invoice, a
parent never sees a general package on `/parent/billing`, and the
session-form + student-detail fixes confirmed directly in the browser.

- Package can be general (usable by any of the tutor's students) OR bound to a specific student (make student_id optional).
- Package builder auto-calculates the price from selected sessions/services and supports a discount (percent or amount) with the total shown live.
- Advertise packages/services/offers on the public tutor page (a tutor can feature them).
- Acceptance: a tutor builds a general 4-session package with a 10% discount, the total auto-calculates, and it can appear on the public page.

## D9 — Email center (templates + preview + custom + notifications)  [x] (fcdc597)

Rewrote the 6 system templates (booking confirmation, session reminder, 3
invoice offsets, invite) with on-brand copy in a single `SYSTEM_EMAIL_TEMPLATES`
source of truth (`lib/email-templates.ts`), backfilled onto existing tutor rows
and the column DEFAULT via the migration, same "only touch untouched defaults"
guard as prior template migrations. `invite_parent` becomes a real
`reminder_templates` key for the first time — replaces the old hardcoded
`lib/invite-email.ts` builder, so the invite email is now tutor-editable like
the other 5. New `notification_settings` (per-tutor on/off switches, absent-key-
means-on for backward compat) and `custom_email_templates` (tutor-authored,
preview-only, not wired to a send trigger) columns. `EmailCenter` renders all 6
system cards collapsed-by-default (shadcn-style `Collapsible`), each with a
variable inserter and a live preview rendered inside a sandboxed iframe via
`renderTemplateEmailHtml`. Parent-facing sends now go through
`parentFacingIdentity()` (`lib/email-identity.ts`): From address stays Slate's
verified domain, From display name becomes "{Tutor} via Slate", Reply-To is the
tutor's own email (D3) so a parent's reply reaches the tutor, not Slate.

xhigh multi-agent code review (7 finders across correctness/security angles,
concurrently) found and fixed 4 real issues before commit: (1) the Resend
`from` header spliced a tutor's raw, unrestricted display name unquoted into an
RFC 5322 mailbox position — a name containing a comma or `<...>` (nothing in
Settings blocks either) either broke Resend's parsing or could be misread as a
second address; fixed by always wrapping the display name in a quoted-string
with `\`/`"` escaped (`lib/email.ts`'s new `quoteMailboxName`), verified live
with a tutor named "Smith, D9 Tutoring" — saved cleanly, no header break. (2)
the cron invoice-reminder loop dropped its old `if (!template) continue` guard
when refactored onto `resolveSystemTemplate` (which returns a blank
subject/body object, not null, for an unrecognized key) — not reachable today
since `reminder_cadence.offsets_days` has no editing UI and always defaults to
`[0,3,7]` (all valid keys), but a real latent regression against a DB column
with no CHECK constraint stopping a future cadence editor; restored the guard
via the existing `SYSTEM_EMAIL_TEMPLATES.some(...)` pattern already used in
`reminder-actions.ts`. (3) the rollback script restored every tutor row's
`reminder_templates` content but never reversed the forward migration's `alter
column ... set default`, so a tutor row created after a rollback would still
start from D9's copy — added the matching `alter column ... set default` back
to the pre-D9 (Q6) copy. (4) the default `booking_confirmation` body ended in
"...See the details here: {{link}}", which dead-ends in a bare colon for any
tutor without a public handle set (reachable — C1 onboarding's handle+bio step
is skippable) since `link` renders empty and the CTA button already
conditionally carries it; dropped the redundant trailing sentence from both the
TS default and the SQL backfill/column-default copies (kept in sync per the
migration's own comment), and pushed the corrected copy to the already-applied
live migration via `supabase db query --linked`. `npx tsc --noEmit` and `npm
run lint` both clean after fixes. QA'd end-to-end in a headless browser: fresh
disposable tutor, skipped onboarding to reach Settings, confirmed the Email
Center renders all 4 notification toggles + 6 collapsed template cards,
expanded "Booking confirmation" and confirmed the live iframe preview
correctly substitutes sample values ("You're all set! Jamie L.'s session with
Alex Rivera is confirmed for Wed, Jan 14 at 3:00 PM." — no dangling link text),
edited the body and confirmed it persisted after a reload, checked dark mode
and 390px mobile (both clean, no overflow). Delivery itself untested — no live
Resend key in this dev environment — but the stub-and-log no-op path (same
pattern as every prior email feature) is unchanged. TODO(connor): the
"{{parent}}" personalization the old hardcoded invite email had ("Hi Jordan,"
vs "Hi,") isn't in the new default `invite_parent` body — the variable is
still available in the inserter for a tutor to add themselves, but wiring a
safe empty-name fallback into the default copy itself was left out of scope
this pass (the template engine has no conditional-on-empty-variable support,
and `parentName` is optional at the call site).

- Rewrite the premade email + notification templates so they read well and on-brand (booking confirmation, reminder, invoice, invite). The current ones are weak.
- Let tutors preview what each email/notification looks like.
- Collapse the template list: each template compressed by default, expands when opened.
- Let tutors edit templates and create their own using premade variables like {{link}}, {{student}}, {{date}}, {{tutor}}, {{amount}} with an inserter + a live preview.
- Per-tutor notification settings: which alerts they get (e.g., new booking) and which go to parents.
- Billing/booking emails to parents must feel like they come from the tutor: send from the verified platform address (EMAIL_FROM, e.g. support@slatetutor.com) but set the From DISPLAY NAME to "{Tutor Name} via Slate" and set Reply-To to the tutor's own email (from their contact info, D3), so a parent's reply goes to the tutor, not to Slate. Never put the tutor's raw email in the From address (SPF/DKIM/DMARC will fail).
- Acceptance: a tutor opens the email center, previews a booking-confirmation email, edits it with a {{link}} variable, and sees the preview render; a sent parent email shows "{Tutor} via Slate" as the sender with Reply-To = the tutor's email; delivery works once Resend is keyed.

## D10 — Booking page more visual  [ ]

- Make the public booking flow more visual and polished (service cards, clearer availability/time selection, tutor photo/branding), keeping the Slate frame. Mobile-first.
- Acceptance: the booking page looks visual and inviting, not a bare list, at desktop and mobile.

## D11 — Availability: per-day hours + unavailability  [ ]

- Let tutors set different hours for specific days (override the weekly default per weekday) and block off specific dates/ranges as unavailable (vacations, one-offs). Booking respects both.
- Acceptance: a tutor sets Fri to 1-3pm (different from the Mon-Thu default) and blocks a specific date; booking offers reflect both.

## D12 — Auto-send invoices  [ ]

- Option to automatically generate and send invoices on a cadence (e.g., weekly) or trigger (e.g., after each session / when a package runs out), tutor-configurable per client, with a clear on/off and preview. Reuses the reminder job infrastructure.
- Acceptance: a tutor enables weekly auto-invoicing for a client and an invoice is generated + queued to send on schedule (delivery gated on Resend, same as D9).

## D13 — Gated / paid resources + invoice add-ons  [ ]

Money-touching + new sharing surface, so /review and update /terms + /privacy per the LEGAL DOCS RULE.

- Let a tutor mark a resource (or a section) as paid/gated: the parent must pay to unlock it. Support gated resources tied to a price, and an optional paid add-on line on an invoice that unlocks specific content/sections when paid.
- Payment reuses the existing Stripe/invoice path; gated content stays locked until payment is confirmed. Manual mark-as-paid also unlocks.
- Acceptance: a parent sees a locked resource, pays (or the tutor marks paid), and it unlocks; RLS prevents access before payment.

## D14 — Installable app + persistent login (PWA)  [ ]

- Make Slate installable (web app manifest, icons from the brand kit, standalone display) so "Add to Home Screen" in Safari opens a real app shell, and keep the session persistent so the user stays logged in in the installed app.
- Acceptance: adding Slate to the Home Screen on iOS Safari opens a standalone app that stays logged in across launches.

## D15 — Integrations (calendar, video, email)  [ ]

Mostly credential-dependent; build what's buildable, mark the OAuth/key pieces [!] blocked with what Connor must provide.

- Google Calendar / Outlook two-way sync (beyond the existing one-way iCal feed). Needs Google/Microsoft OAuth credentials from Connor; build the integration and block on the creds if absent.
- Video links: attach a Zoom or Google Meet link to a session/booking (manual paste first; auto-generation needs Zoom/Google OAuth, block on that). "Not super necessary" per Connor, so keep it light.
- Send email directly from Slate as part of integrations (reuses the email/Resend layer).
- Acceptance: a tutor can attach a meeting link to a session; calendar two-way sync works once OAuth creds are provided (else clearly marked blocked).

---

## Parked (do NOT build in this loop)

- Searchable "find tutors in your area" directory / marketplace + matching. Public tutor pages (Q3) make this possible later, but the directory, search, and tutor discovery are a separate initiative.

## Housekeeping (do when convenient, not blocking)

- The uncommitted PostHog analytics in the working tree: leave it alone unless Connor commits/stashes it. Do not build on top of it.
