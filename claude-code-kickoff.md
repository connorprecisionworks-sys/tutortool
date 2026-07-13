# TutorTool — Claude Code Kickoff (autonomous set-and-forget run)

Paste the block below into a Claude Code session opened in the `Tutortool` folder, then walk away. Code builds phase after phase on its own, makes one clean commit per feature so you review diffs, and only stops for the two things that must stay yours: pushing to your live database and pushing to GitHub. Come back in an hour to a stack of reviewable commits.

Two guardrails that make "set and forget" safe:
- Code builds into a cloud Supabase DEV project (empty, disposable, NOT production). It may push the schema there during the run, but it must never create or touch any other Supabase project. When you launch for real, you point at this project or a fresh prod one.
- Code commits locally but does NOT push to GitHub. You review the diffs, amend or revert what you want, then push yourself. Nothing auto-deploys while you are away.

Prereqs before you paste (one time):
1. Create a Supabase project at supabase.com (name it `tutortool-dev`, pick a region near you, set a database password and SAVE it).
2. From Project Settings > API, copy: the Project URL, the `anon` public key, and the `service_role` key.
3. Note your project ref (the `xxxx` in `https://xxxx.supabase.co`, also shown in Project Settings > General).
4. In your terminal in the `Tutortool` folder, run `supabase login` (it opens a browser to authorize the CLI).
5. Confirm `node -v` is 20+.
Paste the four values (Project URL, anon key, service_role key, project ref) plus your database password into Claude Code along with the prompt so it can link and configure `.env.local`.

---

## PASTE THIS INTO CLAUDE CODE (session opened in the Tutortool folder)

You are building TutorTool, a two-sided billing + scheduling + parent-portal web app for independent tutors. This folder is the repo root. This is an AUTONOMOUS long run: keep working through phase after phase without stopping to ask me, self-correcting as you go, until you have built as much as you safely can. I will review everything afterward as diffs.

SOURCE OF TRUTH. Read these files in this folder first and treat them as the spec. Do not invent scope beyond them:
- MVP-SCOPE.md (what to build, data model, all phases P1-P10, acceptance checks, section 12 = the two-sided platform)
- README.md (brief and context)
- design-system.md (the exact ChatGPT-style black-and-white look, applies to both the tutor app and the parent portal)

STACK (non-negotiable): Next.js (App Router) + TypeScript + Tailwind CSS; Supabase (Postgres, Auth, RLS) via the Supabase JS client and CLI migrations; Stripe (Phase 4/10); deploy target Vercel.

TWO GUARDRAILS FOR THIS UNATTENDED RUN (do not violate):
1. Use ONLY the cloud Supabase DEV project whose credentials I am giving you (Project URL, anon key, service_role key, project ref, database password). Run `supabase link --project-ref <ref>`, put the keys in `.env.local`, and apply migrations with `supabase db push` to THIS dev project. It is empty and disposable and is NOT production, so you may push the schema to it freely during this run. Do NOT create, link, or touch any other Supabase project. Still write a matching rollback SQL file for every migration.
2. Commit locally, do NOT push to any git remote. Make focused, separate commits (one per feature/phase) with clear conventional-commit messages so I can review each diff independently. Never run `git push`. Leave all GitHub pushing and Vercel deployment to me.

DESIGN. Implement design-system.md exactly for both shells. ChatGPT-style monochrome black and white, one typeface (Inter), hairline borders, black as the only accent, generous whitespace, real light and dark mode via CSS variables in globals.css and the Tailwind theme. Tutor shell nav: Dashboard, Clients/Students, Sessions, Invoices, Schedule, Resources, Settings. Parent portal nav: Home, Sessions & Notes, Resources, Schedule, Billing. Role decides which shell loads.

MONEY. Integer cents everywhere, never floats. Display $X,XXX.XX with tabular-nums.

CODE QUALITY GATES (run every phase, fix before moving on, do not stop to ask):
- Run `npm run build` (full next build) and confirm green before each commit. tsc alone is not enough. Server-action modules must have EVERY export be an async function declaration: no re-exports, no `export const`; use an import plus a thin async wrapper.
- Run gstack /qa after each phase to load the app in a headless browser and catch breakage; run /review before committing anything that touches money math, Stripe, or RLS. Do NOT use gstack /ship (it opens PRs).
- RLS on every table. Tutors read/write only their own rows. Parents read only rows tied to their child through `parent_students` (per section 12). Unshared session notes are tutor-only. Write RLS policies in the same migration as the tables and verify them.
- For every schema-changing migration, save a matching rollback SQL file in `supabase/rollbacks/`, never in `supabase/migrations/`.
- Every prospect/parent-facing page passes a page-depth check: empty state, instruction line, smart defaults from real data, inline editing where the scope calls for it, confirmation states, no dead ends, light and dark theme, loading and error states, mobile.

PHILANTHROPIC WORDING. Label discounted/pro-bono value as "value given / community impact." Never call it a tax deduction.

BUILD ORDER (grind straight through; one commit per phase, more commits within a phase if it keeps diffs clean):
- P0 Scaffold: Next.js + TS + Tailwind, Inter + light/dark CSS variables, both app shells with routed empty pages, Supabase client, `.env.local` (from the credentials I gave you) + `.env.local.example`. Run `supabase init`, make a `supabase/rollbacks/` folder, run `supabase link --project-ref <ref>` to connect the cloud dev project. Migrations from P1 on get applied with `supabase db push` to this dev project.
- P1 Schema + tutor auth + student CRUD with rate rules (per MVP-SCOPE section 7).
- P2 Session logging with travel time + effective-rate snapshot + billed/unbilled + rate math correct to the cent.
- P3 Invoices from unbilled sessions + line items + totals + send (email link placeholder) + manual mark-as-paid + billed exactly once.
- P4 Stripe Connect Express (test mode) onboarding + payment link + webhook auto-marks paid (idempotent on event id). Use Stripe test keys from `.env.local`; if absent, build the full integration and stub the keys, noting it in the summary.
- P5 Reminder job + editable templates + philanthropic value-given rollup + dashboard numbers.
- P6 Roles + parent signup + per-student invite codes + parent onboarding bound to the pre-added child + RLS isolation (section 12).
- P7 Session notes authoring + share toggle + parent notes view.
- P8 Resources library (file/link) scoped to student/class + parent view.
- P9 Scheduling: tutor availability + selectable mode per student/class (request / calendar / message); confirmed booking creates a session (section 12).
- P10 Parent billing view + pay via the Stripe link from P4.

Go as far as you can. If you hit something genuinely ambiguous, make the most reasonable choice consistent with the spec, leave a `// TODO(connor):` comment, note it in the summary, and keep going. Do not stall.

WHEN YOU FINISH (or run out of runway), STOP and give me a single summary:
- The ordered list of commits with the one-line message for each, so I can review diffs in order.
- Which phases are complete vs partial, and what each partial one still needs.
- Every `TODO(connor)` and every decision you made on my behalf.
- Confirmation of which migrations you pushed to the dev project, plus the env vars and the git push / Vercel deploy sequence for me to run.
- Anything that needs a real key I did not have (Stripe, email provider).

Begin now with P0 and keep going.

---

## After the run (Connor)

1. Skim the commit list in Code's summary. Review diffs commit by commit: `git log --oneline` then `git show <hash>` for each in your terminal in the `Tutortool` folder.
2. Amend or revert anything you do not like. Make your few changes.
3. When happy: create the GitHub repo and push (`gh repo create`, `git push`), then connect Vercel and point it at your Supabase dev project (or a fresh prod project). Set env vars (Supabase URL + anon + service_role, Stripe test keys, email provider key).
4. Paste Code's summary back here and I will review the decisions it made and the go-live steps before you deploy.

Prereqs by phase: the cloud Supabase dev project + `supabase login` + Node now. Stripe test keys and an email provider (Resend is simplest) only when you want P4 and P3 wired with real keys. Decide before real launch: Stripe Connect flavor (Express recommended) and who eats the ~2.9% + 30c fee.
