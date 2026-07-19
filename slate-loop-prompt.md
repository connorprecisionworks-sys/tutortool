# Slate — Standing Loop Prompt

Paste this once into a Claude Code session in the `Tutortool` folder and walk away. Code works the whole build queue unattended, commits each item separately, and never pushes. Come back and paste the summary here for review.

---

## PASTE INTO CLAUDE CODE (session in the Tutortool folder)

You are running the Slate build loop. Work autonomously through the whole queue without stopping to ask me. I will review afterward as diffs.

READ FIRST, in this folder: build-queue.md (the prioritized work list, decisions already baked in), BRAND.md (brand), MVP-SCOPE.md and design-system.md (product + look). Treat build-queue.md as the source of truth for what to build and in what order.

LOOP, repeat until every item is done or blocked or you run out of runway:
1. Pick the topmost item in build-queue.md that is not done or blocked.
2. Mark it [~] in progress in build-queue.md.
3. Build it fully per its spec and acceptance check. Apply the global rules in build-queue.md (Slate brand, integer cents, RLS, page-depth bar, light+dark, mobile).
4. Run npm run build and confirm green. Server-action modules: every export must be an async function declaration (no re-exports, no export const; use an import + thin async wrapper).
5. Run gstack /review on anything touching money, Stripe, RLS, auth, or public/unauthenticated routes, and /qa in a headless browser to click the acceptance flow. Fix what they find before committing. Do NOT use /ship.
6. Commit with a clear conventional-commit message (one item can be several commits if it keeps diffs clean).
7. Update build-queue.md: mark the item [x] done with the commit hash(es) and a one-line note. If it depended on a migration, keep its rollback SQL in supabase/rollbacks/.
8. Move to the next item.

GUARDRAILS (do not violate):
- Never run git push. Commit locally only; I push and deploy myself after review.
- Migrations: apply to the linked dev Supabase project is fine; write a rollback for each. Do not touch any other project.
- If an item is genuinely BLOCKED (needs a real API key I do not have, an external account, or a product decision not covered in build-queue.md), mark it [!] blocked in build-queue.md with one line on why, then skip to the next buildable item. Do NOT stall or invent scope.
- Leave the uncommitted PostHog change in the working tree alone; keep your commits scoped away from it.
- On any genuine ambiguity within an item, make the most reasonable choice consistent with build-queue.md, leave a // TODO(connor): comment, note it, and keep going.

WHEN YOU FINISH (all done/blocked or out of runway), STOP with ONE summary:
- Items completed, each with its commit hash(es) and a one-line description.
- Items blocked, each with why and what you need from me.
- Every TODO(connor) and any decision you made on my behalf.
- Anything needing a real key (Stripe, Resend, Twilio) to fully work.
- Confirm build/lint green and working tree state.

Begin with the topmost todo item in build-queue.md and keep going.

---

## How the loop keeps running (Connor)

- Paste the block above, leave. Come back to a stack of commits + a summary.
- Paste the summary here in Cowork. I review the money/RLS/public-route work, resolve any blocked items, and replenish build-queue.md with the next batch.
- When you want it live: handle the PostHog change (commit or stash), then git push so Vercel deploys.
- Blocked items usually just need a key: Stripe (payments/refunds), Resend (email), Twilio (SMS). Add those when you are ready and re-run the loop to unblock them.
