# TutorTool — Business back-office for independent tutors

The brief. Problem, MVP, stack, team, status. Deeper build detail in `mvp-scope.md`, decisions in `decisions.md`.

---

## Problem

Independent tutors run a real business on paper and text messages. They set different rates for different families (professional discount, friend rate, low-income/pro-bono), drive to sessions, buy supplies and curriculum, and chase parents for payment over text with copy-paste messages. Nothing tracks who owes what, what got discounted, what was driven, or what can be written off at tax time. TutorTool is the back office that runs the money side so the tutor just tutors.

## Design partner

- **Beth Donovan** (331Marlberry@gmail.com) — tutor, first design-partner interview 2026-07-12. Notes captured below.
- Beth's contact **Donna Reed** — potential second interview / user.

## MVP wedge (locked 2026-07-13)

**Billing + invoicing engine.** The money layer first: flexible rate tiers per client, log sessions (with travel time), generate invoices, track sent-vs-paid, auto-remind on unpaid. Everything else (full expense/receipt/mileage tax suite, scheduling) sits behind this and plugs in later. Rationale: getting paid correctly and on time is the sharpest pain and the thing a tutor will pay for. Build one thing all the way, not five things halfway.

**Payments: Stripe.** Venmo and Zelle have no usable API to verify incoming payments, so "did the parent pay yet" can't be automated on those rails. Stripe is the only clean programmatic path: tutor sends a Stripe invoice/payment link, a webhook flips the invoice to Paid automatically. Manual "mark as paid" stays as a fallback for tutors who insist on Venmo/Zelle. See `decisions.md`.

## Feature areas (from Beth's notes)

- **Flexible billing** — per-client rate tiers: standard, professional discount, close-friend rate, low-income/discounted, pro-bono. Bill session duration plus tutor travel time.
- **Invoicing** — generate, send, track sent vs paid, automated payment reminders. (Currently: parent texts, tutor sends a copy-paste message.)
- **Philanthropic tracking** — tag discounted/pro-bono work and total the value given, philanthropic vs regular. NOTE: donated *services* are not tax-deductible in the US (only out-of-pocket costs are), so this is for the tutor's own records and impact story, not a write-off. See `decisions.md`.
- **Sessions + travel** — log session duration and the tutor's travel time; travel is billable. Location-aware.
- **Expense + tax (later phase)** — receipt capture for supplies/curriculum/training, mileage from session locations + average gas prices, expense categorization for tax.

## Stack

Connor default: Next.js + React + Tailwind, Supabase (Postgres + auth + RLS), Stripe for payments, Vercel deploy. Candidate to be built by the Antfarm agents.

## Team

- **Connor** — owner, architecture, brain.
- **Gavin** — outreach (likely also some dev).
- **Will** — primary developer + outreach.

## Status

2026-07-13: scoped. Billing-engine MVP + Stripe locked. Brief + `mvp-scope.md` + `decisions.md` written. Next: Will builds against the MVP scope, or Antfarm agents do. Linked working folder: `Tutortool/` (repo home).
