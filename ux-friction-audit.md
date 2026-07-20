# UX Friction Audit — Baseline (E1)

Measured 2026-07-20 in a real headless browser (gstack `/browse`) against a fresh, disposable
tutor account (`connor.precisionworks+e1audit@gmail.com`) on `localhost:3000`, walking each flow
exactly as a tutor would, click by click and keystroke by keystroke. Nothing was estimated —
every count below comes from an actual snapshot-by-snapshot walkthrough.

**Test account setup:** standard rate $50/hr, Mon–Fri 15:00–18:00 availability, public handle
`e1audit`, one service ("Tutoring session", 60 min, $50) — all set via the onboarding wizard
(C1), which is not one of the 10 measured flows. One student ("Jamie Rivera") was then added
through the normal app (counted below as flow #3) so the flows that need an existing student
had something to act on.

"Clicks" = every mouse click including nav clicks, quick-action clicks, dropdown/select
interactions, checkbox toggles, and the final submit. "Keystrokes" = exact character count typed
into text/number fields (measured with `len()` on the literal string typed, not "1 per field").

## Results

| # | Flow | Clicks | Keystrokes | Entry point |
|---|------|--------|------------|--------------|
| 1 | Log a session | 2 | 0 | Dashboard "Log session" quick action → submit |
| 2 | Create + send an invoice | 3 | 0 | Dashboard "New invoice" quick action → Build draft → Send invoice |
| 3 | Add a student | 2 | 12 | Dashboard "Add student" quick action → fill name ("Jamie Rivera") → submit |
| 4 | Share a student code | 2 | 0 | Students nav → "Copy link" on the student's row |
| 5 | Create + share a booking link | 5 | 15 | Booking Links nav → New booking link → fill Date ("2026-07-21") + Time ("15:00") → Create link → Copy → Done |
| 6 | Add a service | 4 | 10 | Settings nav → Manage services → Add service → fill Name ("SAT Prep") + Price ("75") → submit |
| 7 | Cancel a session | 4 | 0 | Sessions nav → click session → Cancel session → Confirm cancellation |
| 8 | Set availability | 3 | 0 | Schedule nav → toggle "Sat" checkbox → Apply to selected days |
| 9 | Add an expense | 4 | 2 | Expenses nav → Add expense → select student (Jamie Rivera) → fill Amount ("25") → submit |
| 10 | Create a package | 4 | 26 | Packages nav → New package → select Service (SAT Prep) → fill Package name ("4-Session SAT Prep Package") → submit |

**Friction points observed, per flow:**

| # | Flow | Friction points observed |
|---|------|---------------------------|
| 1 | Log a session | None of substance. Student, date, and duration are all defaulted correctly. Service defaults to "None — bill at hourly rate" rather than the student's usual service, but with only one student and one service in this test there's nothing meaningfully "usual" yet — flag for E2 once repeat-session behavior can be tested with real history. |
| 2 | Create + send an invoice | Already lean (3 clicks, 0 keystrokes) — student and date range prefilled, unbilled session auto-included in the draft. Real gap: the invoice was accepted and marked "Sent" even though the student has **no payer email on file** and Stripe isn't connected — nothing was actually delivered anywhere, but the UI shows success with no warning. |
| 3 | Add a student | Already at the true minimum — name is the only required field, exactly per the E2 acceptance bar. Student code is generated automatically without an extra step. |
| 4 | Share a student code | Already lean (2 clicks) and already auto-copies to the clipboard on click — good. But there is **no toast or visible confirmation** after "Copy link" is clicked; the button label doesn't change and no message appears, so the tutor has no feedback the copy worked. |
| 5 | Create + share a booking link | The most friction of the 10 flows. (a) The **default mode is "Offer specific times"**, whose Date and Time fields are empty and required — this is what forced the 15 keystrokes, even though the tutor already has Mon–Fri 15:00–18:00 availability configured and Slate could propose a slot from it. (b) The zero-typing "Open availability (standing)" mode exists but requires an extra click to switch to and is not the default. (c) After the link is created it is **not auto-copied** — a separate "Copy" click is required, breaking the Resend-style pattern this batch is named for. (d) A "Done" click is then needed just to leave the confirmation screen — a step that exists only to dismiss, not to do anything. |
| 6 | Add a service | Duration defaults sensibly (60 min) but **Price has no default** and must be typed from scratch even though the tutor already set a standard hourly rate in Settings. Also buried two clicks deep (Settings → Manage services → Add service) with no direct nav entry or dashboard quick action, despite being one of the 10 highest-frequency actions named in this batch. |
| 7 | Cancel a session | Appropriately keeps a confirmation step (choosing credit/refund/charge-in-full, defaulting to the tutor's own Settings default) because this is a money-moving action — correctly respects the batch's safety exception. No unnecessary friction found here. |
| 8 | Set availability | Already lean — day toggle + reusing the last-entered start/end time + one Apply click. No real friction. |
| 9 | Add an expense | Already close to the minimum — Category and Date both default sensibly, Amount is the only required field. Student selection (used here to satisfy "expense against a student") is optional, so the true minimum is actually 3 clicks / 2 keystrokes if no student is tagged. |
| 10 | Create a package | Selecting a Service correctly auto-derives the per-session price (good — no separate price entry needed once a service is picked). But **Package name has no default** and must be typed in full (26 keystrokes for a name that's entirely derivable from the student, service, and session count already selected on the same form). |

## Proposed fixes

Ordered roughly by impact, grounded in the Batch 5 principles (smart defaults, auto-copy +
toast on anything generated, edit in place, minimum required fields, drop confirms only on
non-destructive steps, never touch confirms on money-moving actions).

1. **Booking links (flow 5) — biggest win.**
   - Default the "New booking link" form to **Open availability (standing)** mode instead of
     "Offer specific times." Standing links need zero typing (student/service/duration/buffer
     are all already defaulted); specific-time links should be the opt-in path for the less
     common case, not the default.
   - If a tutor does pick "Offer specific times," prefill Date/Time with the next open slot
     computed from the tutor's own availability rules (already known — Mon–Fri 15:00–18:00 in
     this account) instead of leaving both blank and required.
   - Auto-copy the created link to the clipboard the instant it's created, with a toast ("Link
     copied — send it to the parent"), and drop the separate "Copy" click — this is exactly the
     Resend pattern named as the north star for this batch.
   - Drop the "Done" click. Once the link is copied, either auto-redirect back to the Booking
     Links list after a short delay or just let the "Copy" action itself close/exit the flow —
     "Done" confirms nothing harmful, so it's a pure removable step.
   - Combined effect: 5 clicks / 15 keystrokes → roughly 2 clicks / 0 keystrokes (nav + one
     "Create & copy" button) for the common standing-link case.

2. **Add a service (flow 6) — prefill price.** Default "Price ($)" from the tutor's existing
   standard hourly rate × the duration already on the form (e.g., 60 min at $50/hr → prefill
   $50, editable). Cuts the typed amount to zero for the common case where a service is billed
   at or near the standard rate. Also worth a direct "Services" entry point (nav item or
   dashboard quick action) so it isn't nested two clicks inside Settings for something this
   batch flags as high-frequency.

3. **Create a package (flow 10) — auto-generate the name.** Prefill "Package name" from the
   already-selected Student + Service + Total sessions, e.g. "Jamie Rivera — 4× SAT Prep,"
   editable in place if the tutor wants something different. Removes 26 keystrokes for the
   default case down to near zero.

4. **Share a student code (flow 4) — add a toast.** The copy-on-click behavior is already
   correct and matches the E3 pattern; it just needs a confirmation toast ("Copied invite link
   to clipboard") so the tutor isn't left guessing whether the click did anything. Low effort,
   closes the loop on a flow that's otherwise already the model example for this batch.

5. **Invoice send (flow 2) — warn before a silent no-op send.** Not a click/keystroke fix, but
   a trust gap this audit surfaced: sending an invoice with no payer email and no Stripe
   connected currently succeeds and shows "Sent" with nothing actually delivered. Add an inline
   warning ("No payer email on file — add one or copy the invoice link to send it yourself")
   before allowing Send in that state, or auto-copy the invoice link to the clipboard as a
   fallback delivery method when there's no email to send to. This is additive (a warning +
   copy), not a removed confirmation, so it doesn't conflict with the money-moving safety
   exception.

Flows 1 (log a session), 3 (add a student), 7 (cancel a session), 8 (set availability), and 9
(add an expense) are already lean today — measured at or near the practical minimum given the
data available in a fresh account, and in flow 7's case correctly keeping a confirmation step
because it's money-moving. No changes are proposed for these beyond what E2's broader
"prefill from last session" work will naturally pick up once real session history exists.

---

# UX Friction Re-Measurement — After Batch 5 (E6)

Measured 2026-07-20 in a real headless browser (gstack `/browse`, desktop 1440×900 viewport —
the E1 baseline's dashboard "quick action" entry points only render at desktop width; below a
mobile breakpoint the sidebar collapses behind a hamburger menu, which is a separate,
unmeasured surface) against a fresh, disposable tutor account
(`connor.precisionworks+e6remeasure@gmail.com`), pushed through the same onboarding as E1
(standard rate $50/hr, Mon–Fri 15:00–18:00 availability, handle `e6remeasure`, one service
"Tutoring session" 60 min $50). Same admin-API pattern (`.env.local` service-role key,
`email_confirm: true`, sign in via `/login`). Every flow below was walked with the *same entry
point* E1 used (nav clicks, not the new Cmd/Ctrl+K palette — see note at the end) and counted
the same way: clicks = every mouse click including nav, quick-action, dropdown/select, checkbox,
and final submit; keystrokes = exact `len()` of what was typed.

**Session-history setup for flow #1:** added one student ("Jamie Rivera", counted as flow #3
below), then logged one real session for her using the actual "Tutoring session" service (60
min) — this session is *not* one of the 10 measured flows, it exists purely to give the account
one real repeat-session history, matching the batch's own acceptance line ("logging a repeat
session for an existing student"). A second student ("Alex Fresh") with zero session history was
also added to re-confirm the fresh-student case is unaffected (see flow #1 below).

## Results

| # | Flow | Before (E1) | After (E6) | % reduction | What changed |
|---|------|--------------|------------|-------------|--------------|
| 1a | Log a session — **fresh student, first-time** | 2 clicks / 0 keystrokes | 2 clicks / 0 keystrokes | No change | Confirmed still correct: with zero session history, Service still defaults to "None — bill at hourly rate" (nothing to prefill from). Re-verified against a brand-new student ("Alex Fresh") to rule out a regression — none found. |
| 1b | Log a session — **repeat, same service** | 2 clicks / 0 keystrokes | 2 clicks / 0 keystrokes | No change in count, but a real correctness fix | Click/keystroke count is identical to 1a because the fields were already zero-typing — but *what* gets prefilled changed: Service now correctly carries over "Tutoring session" from Jamie's prior session (verified live in `/tutor/sessions/new` — Student, Service, Duration, and Travel all pre-populated from her last session) instead of defaulting to "None" regardless of history, which is what the E1 baseline actually measured (its one test student had no prior session, so it never exercised this path). **E2's prefill.** |
| 2 | Create + send an invoice | 3 clicks / 0 keystrokes | 3 clicks / 0 keystrokes | No change | Unchanged, as expected — E2 explicitly scoped the invoice-send trust-gap warning out. Re-confirmed the same gap still exists: sent an invoice for a student with no payer email and no Stripe connected, and it still shows "Sent" with nothing actually delivered anywhere. Not a regression, just not yet fixed — flagged again below. |
| 3 | Add a student | 2 clicks / 12 keystrokes | 2 clicks / 12 keystrokes | No change | Already at the true minimum per E1; unchanged. |
| 4 | Share a student code | 2 clicks / 0 keystrokes | 2 clicks / 0 keystrokes | No change in count, but closes the feedback gap | Click count identical (Students nav → "Copy link"). Verified in source (`components/students/copy-student-code-button.tsx`) that the click now calls `toast("Link copied to clipboard", { variant: "success" })` right after the clipboard write succeeds — the exact gap E1 flagged ("no toast or visible confirmation"). Could not visually observe the toast firing in this headless run because `navigator.clipboard.writeText` throws without a granted clipboard permission in this sandbox (confirmed via the CDP allowlist rejecting `Browser.grantPermissions`) — the same documented environmental limitation E3's own QA hit and verified was pre-existing/sandbox-only, not app-specific. **E3's auto-copy + toast.** |
| 5 | Create + share a booking link | 5 clicks / 15 keystrokes | **3 clicks / 0 keystrokes** | **40% fewer clicks, 100% fewer keystrokes** | Biggest win, as predicted. Landed on `/tutor/booking-links/new` and it now defaults to "Open availability (standing)" mode (was "Offer specific times") — zero required fields, "Create standing link" is clickable immediately. On click, the link auto-copied and the page auto-redirected back to the Booking Links list ~1.3s later with no separate "Copy" or "Done" click. New flow: Booking Links nav → New booking link → Create standing link (3 clicks total; the build-queue's own estimate of "2 clicks" undercounted the "New booking link" click itself, so 3 is the honest apples-to-apples count against E1's methodology). **E2's default-mode flip + E3's auto-copy/auto-redirect.** |
| 6 | Add a service | 4 clicks / 10 keystrokes | 4 clicks / **8 keystrokes** | No click change, **20% fewer keystrokes** | Still nested two clicks inside Settings (Settings → Manage services → Add service) — no direct nav entry or dashboard quick action was added (E5's command palette does surface "new service" as a quick-action, but per the instructions that doesn't count toward this nav-based baseline). Price now auto-prefills to `$50.00` (standard rate × 60 min duration) instead of empty — verified live on `/tutor/settings/services/new`. Only "Name" needs typing now ("SAT Prep" = 8 chars vs. the old Name+Price = 10). **E2's price prefill.** |
| 7 | Cancel a session | 4 clicks / 0 keystrokes | 4 clicks / 0 keystrokes | No change | Confirmation step (handling dropdown + "Confirm cancellation") correctly still required — money-moving safety exception respected. Verified end-to-end: cancelled a real unbilled session, status flipped to "Cancelled" in the Sessions list. |
| 8 | Set availability | 3 clicks / 0 keystrokes | 3 clicks / 0 keystrokes | No change | Already lean; unchanged. Verified toggling "Sat" + "Apply to selected days" still adds a 6th availability rule in one pass. |
| 9 | Add an expense | 4 clicks / 2 keystrokes | 4 clicks / 2 keystrokes | No change | Already near the minimum per E1 (Category/Date default sensibly, only Amount is required); unchanged. |
| 10 | Create a package | 4 clicks / 26 keystrokes | 4 clicks / **0 keystrokes** | No click change, **100% fewer keystrokes** | Same click count (Packages nav → New package → select Service → submit) but Package name is now fully auto-derived and live-recomputes off the selected Student + Service + Total sessions — verified via the input's actual DOM `value` (`"Jamie Rivera — 4× Tutoring session"`, then `"Jamie Rivera — 4× SAT Prep"` after switching Service), never had to type a single character. Created the package, which correctly rolled into a $200.00 invoice draft (4 × $50 SAT Prep). **E2's name auto-derivation.** |

**Totals across all 10 flows** (using the 1b repeat-session number, the scenario E2's acceptance
line actually targets): clicks **33 → 31** (6% fewer, entirely from flow 5's booking-link win —
every other flow's click count is unchanged by design, since Batch 5's principles reduce typing
and confirm-clicks, not navigation depth); keystrokes **65 → 22** (66% fewer), driven almost
entirely by three flows: booking links (15→0), package name (26→0), and service price (10→8).

## Honesty check — flows that did not improve, and why

Five flows (2, 3, 7, 8, 9) show **zero** change in either clicks or keystrokes, and that's the
correct, honest result, not an oversight:

- **Add a student (3)** and **Set availability (8)** were already at the practical minimum in
  E1 — there was nothing left to trim without cutting a required field or the money-moving
  confirmation step.
- **Cancel a session (7)** correctly keeps its confirmation step under the batch's own SAFETY
  EXCEPTION (never remove confirmation from a money-moving action) — this is working as
  designed, not a miss.
- **Add an expense (9)** was already near-minimum (Category/Date default, only Amount required);
  Batch 5 didn't specifically target it and E2's prefill work doesn't apply (there's no "last
  expense" concept to carry forward the way there is for sessions/services/packages).
- **Invoice send (2)** is unchanged because E2 explicitly scoped out the trust-gap warning
  (fixing a silent "Sent" state with no payer email/Stripe is a correctness fix, not a
  click-reduction, and was judged out of scope for a pure-prefill item). The gap E1 found is
  still there today — flagging it again as a real, open item, not a regression.

Two more flows (1, 4) show no change in the click/keystroke *count* but did genuinely improve in
a way that number doesn't capture: flow 1's repeat-session case now prefills the *correct*
service instead of silently defaulting to "None" (a correctness fix, since the click count was
already 2/0 either way), and flow 4 gained a toast confirmation on top of an already-lean click
count. Both are real Batch 5 wins; they just don't move the click/keystroke numbers because those
numbers were never the bottleneck for these two flows — the missing feedback/correctness was.

## Alternative entry point: the command palette

Per the task instructions, the headline before/after table above uses the same nav-click entry
points E1 used, for a fair comparison. Separately worth noting: E5 added a global Cmd/Ctrl+K
command palette that offers a keyboard-only alternative path to 8 of these flows (log session,
new invoice, add student, set availability, new service/package/booking link, add expense) plus
fuzzy-matched student search — e.g. `⌘K` → type "log ses" → `Enter` reaches `/tutor/sessions/new`
with the Student field already focused, with autofocus on the first field of 7 forms (E5) meaning
Tab/Enter alone can complete several of these flows with zero mouse clicks after the palette
opens. This isn't reflected in the table above because it would not be an apples-to-apples
comparison against E1's nav-click baseline.

## No regressions found

Every flow above was walked end-to-end in the real app (not estimated) and produced the expected
result: the second session logged correctly, the invoice correctly totaled and sent (with the
known, pre-existing trust gap unchanged), the booking link correctly appeared in the list with
"Standing"/"Open" status, the cancelled session correctly showed "Cancelled," the new
availability rule correctly appeared, the expense and package both correctly appeared with the
right amounts. No flow got *slower* and nothing errored. The one non-obvious finding — the
Students-list "Copy link" toast not being visually observable — was confirmed to be a headless
Chromium clipboard-permission sandbox limitation (the same one E3's own QA documented hitting),
not an app regression: verified via source inspection that `toast(...)` is called immediately
after a successful `navigator.clipboard.writeText`, and that the write itself is what throws in
this sandbox before the toast call is ever reached.

Test tutor (`connor.precisionworks+e6remeasure@gmail.com`) deleted after measurement; cascade
verified 0 rows across `tutors`/`clients`/`sessions`/`invoices`/`packages`/`booking_links`/
`expenses`.
