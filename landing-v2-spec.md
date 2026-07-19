# Slate — Landing Page v2 (modeled on campfire.ai)

Rebuild the public landing page at the root route, modeled on campfire.ai's structure and editorial confidence, but in the Slate brand (slate blue accent, near-black/off-white, Inter Tight headings, Inter body, per BRAND.md). Campfire is the LAYOUT reference, not the color palette. Clean, modern, lots of whitespace, big bold type, real product UI, subtle motion.

Honesty rule: Slate has no customers yet. Do NOT invent customer logos, names, or testimonials. Build the testimonial component but keep it hidden behind a flag with a // TODO(connor) until a real quote exists. No fake trust badges.

Product UI in the page should be real: render actual Slate components (a dashboard snippet, an invoice, a booking link, the parent portal) as styled in-app mockups rather than stock images or fabricated screenshots.

## Sections, top to bottom

1. **Announcement bar** (thin, dismissible, slate-blue tint): one line, e.g. "New in Slate: send a booking link and get paid in one flow." Dismiss persists.

2. **Sticky nav:** Slate lockup left; center/right links (Features, How it works, Pricing anchor if present else omit); right side "Log in" (text) + "Sign up free" (slate-blue button). Condenses to a hamburger on mobile.

3. **Hero:** big Inter Tight headline "Run your business. Focus on what matters." Subhead: "Slate is the back office for independent tutors. Rates, sessions, invoices, scheduling, and getting paid, handled, so you can focus on teaching." Two CTAs: "Sign up free" (primary, slate blue) and "See how it works" (secondary, scrolls to the how-it-works section). Under the hero, a clean product mockup (the tutor dashboard) in a framed panel.

4. **Capability marquee:** one or two rows of slate-blue-on-off-white pills scrolling horizontally (infinite loop, pauses on hover, respects prefers-reduced-motion): Invoices, Travel time, Automatic reminders, Booking links, Parent portal, Session notes, Cancellations & credits, Prepaid packages, Expenses & mileage, Business insights, Card payments, Recurring sessions, Public booking page.

5. **Product overview ("Everything the money side needs"):** 4 feature cards, each a title + one line + a small real UI thumbnail: Billing & invoices; Scheduling & booking; Parent portal; Business insights.

6. **How it works (3-up, mirrors campfire's 3 callouts):** 1) Set your rates and services. 2) Log sessions, or let parents book with a link. 3) Send invoices and get paid. Slate handles reminders, cancellations, and the rest. Each with a small mockup.

7. **Feature grid ("Built for how tutors actually work"):** alternating rows, real UI mockup beside copy:
   - Send a link, they book. Offer times, parents pick, it becomes a billable session. No back-and-forth.
   - Cancellations, handled. Roll over to a credit or refund in a tap, on your policy.
   - Prepay and packages. Sell a block of sessions, draw them down automatically.
   - Taxes, minus the shoebox. Capture receipts, log mileage, export a year-end summary.
   - A portal for every parent. Notes, schedule, resources, and bills, scoped to their child.
   - Know your numbers. Revenue, outstanding, and upcoming income at a glance.

8. **Testimonial slot:** styled quote block with a metric, HIDDEN behind a flag + // TODO(connor) until a real tutor quote exists. Do not fabricate one.

9. **Final CTA band:** "Start running your tutoring like a business." Subhead "Free to start." Button "Sign up free." Small "Book a demo" link to CALCOM_LINK.

10. **Rich footer:** Slate lockup + one-liner; columns: Product (Features, Booking, Parent portal), Company (About, Contact), Resources (Book a demo), Legal (Privacy, Terms); social row; copyright.

## Behavior + rules

- Logged-in visitors to `/` redirect to their dashboard (tutor) or portal (parent); logged-out see the landing.
- Primary CTA "Sign up free" -> tutor signup; "Log in" -> login; "Book a demo" -> CALCOM_LINK (Connor swaps the real URL).
- Slate brand only: slate blue is the single accent, everything else grayscale; Inter Tight headings, Inter body; real light and dark mode.
- Subtle motion only: marquee scroll, gentle fade/rise on scroll into view; respect prefers-reduced-motion. No heavy shadows or gradients.
- Fully responsive, mobile-first. Page-depth bar applies (loading/empty/error not really relevant here, but mobile + both themes are).
- Replace the existing landing route in place; do not break auth or the logged-in redirect.
