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

## Q2 — Native booking link ("send a link, parent picks")  [ ]

The centerpiece from the tutor process: no back-and-forth, tutor sends dates, parent picks.

- Tutor builds a booking request: pick a student (or leave open for a new parent), pick a service, and select one or more offered date/time slots from their availability. Generate a shareable booking link (tokenized, e.g. /book/TOKEN).
- Parent opens the link (no login required to view), sees the tutor + service + offered slots, picks one, and confirms with name/email. Confirming creates a confirmed booking -> a `sessions` row (so it flows into billing) and links/creates the parent+student as needed.
- Tone and UX modeled on Cal.com's clean single-purpose booking page (study Cal for UX; do NOT integrate Cal, build native).
- Send the tutor a notification on booking (email if Resend set, otherwise in-app).
- Acceptance: tutor offers 3 slots, opens the link in an incognito window as a parent, books one, and it appears as a confirmed session on the tutor side with no double-entry.

## Q3 — Public tutor page (profile + pricing + scheduling)  [ ]

The "pricing and scheduling pages" + public profile. Doubles as directory-ready later (directory search itself is PARKED).

- Public route /t/[handle] (tutor picks a handle in Settings). Shows tutor name, short bio, subjects, their active services + prices, and a "Book" button that opens the native booking flow (Q2).
- Editorial Slate styling, no login to view, mobile-first, shareable.
- Tutor controls what's public (toggle bio/prices visibility).
- Acceptance: a tutor sets a handle and bio, publishes, and the public page renders their services and a working Book button.

## Q4 — Cancellations (default policy + override)  [ ]

Tutor sets a default; overrides per session. Default policy = roll-over credit.

- Tutor setting: default cancellation handling = roll-over credit (default) | refund | charge in full. Plus a cancellation window (e.g. cancel >24h = free, inside = charge), tutor-configurable.
- On cancelling a session: apply the default, with a per-session override to refund, roll over to a credit, or charge. A roll-over creates a `credits` row applied to the next invoice; a refund on a paid session triggers a Stripe refund (behind the Stripe key); a charge keeps the session billable.
- Credits reduce the next invoice total and show as a line. Never let totals go negative silently; cap and carry.
- Acceptance: cancel a paid session as roll-over -> a credit appears and reduces the next invoice; cancel as refund -> a Stripe refund is initiated (or clearly stubbed if no key).

## Q5 — Prepay & packages  [ ]

From "prepaying for a week or paying before or after."

- Support pay-before and pay-after per invoice/booking (tutor default + per-invoice choice).
- Packages: tutor sells N sessions (or a week block) upfront; parent prepays; sessions draw down the balance; remaining balance visible to both sides. A cancellation on a package restores the session to the balance (ties to Q4 roll-over).
- Acceptance: parent prepays a 4-session package, three sessions draw it to 1 remaining, a cancelled one restores it to 2.

## Q6 — Automatic session reminders (email)  [ ]

Extend the existing invoice-reminder engine to sessions and bookings.

- Booking confirmation email to the parent on booking (Q2).
- Upcoming-session reminder to the parent (tutor-configurable lead time, e.g. 24h before). Reuse the reminders job + templates; log every send.
- Gracefully no-op without Resend (log intent), same pattern as invoices.
- Acceptance: a session 24h out generates a logged reminder; a new booking generates a logged confirmation.

## Q7 — Tutor code + parent-side setup  [ ]

Add a tutor-level join code alongside the per-student codes (keep student codes working).

- Each tutor has one shareable tutor code / link. A parent who joins via the tutor code lands in a lightweight setup: enter their child's name (or pick from the tutor's unclaimed students), creating the parent+student link. Tutor sees and can confirm/merge new parent-created students.
- Keep per-student codes fully working; this is additive.
- Polish the parent-side account setup so a parent goes from code to a working portal in the fewest taps (email confirmation off).
- Acceptance: a parent joins with the tutor code, adds their child, and the tutor sees the new linked student to confirm.

## Q8 — SMS reminders (research + build, key-gated)  [ ]

"Look into SMS reminders."

- Add SMS as a reminder channel via Twilio, behind TWILIO_* env keys (same disabled-until-configured pattern as Resend). Tutor + parent opt-in and phone capture with consent language. Reminders (session + invoice) can send by SMS when enabled.
- At the top of the work, drop a short `notes/sms-reminders.md` covering Twilio setup, cost per segment, and A2P 10DLC registration (US SMS compliance) so Connor knows the real-world requirements before turning it on.
- Acceptance: with Twilio keys set, an opted-in parent gets an SMS reminder; without keys, the option is cleanly disabled.

---

## Parked (do NOT build in this loop)

- Searchable "find tutors in your area" directory / marketplace + matching. Public tutor pages (Q3) make this possible later, but the directory, search, and tutor discovery are a separate initiative.

## Housekeeping (do when convenient, not blocking)

- The uncommitted PostHog analytics in the working tree: leave it alone unless Connor commits/stashes it. Do not build on top of it.
