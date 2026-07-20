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
