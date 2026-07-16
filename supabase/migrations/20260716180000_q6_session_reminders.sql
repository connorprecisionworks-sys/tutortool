-- Q6: extends the existing invoice-reminder engine (table, dedup pattern,
-- template interpolation) to two session-triggered emails instead of
-- building a second, parallel logging system:
--   - 'booking_confirmation' — sent once, right when a booking is confirmed
--     through Q2's confirm_booking_link (per the build-queue spec, this is
--     scoped to the public /book/TOKEN flow specifically — P9's separate
--     per-student request/calendar/message booking flow isn't touched here)
--   - 'session_reminder' — sent once per session by the daily cron job, for
--     ANY not-cancelled session with a start_time (regardless of which flow
--     created it — logged manually, via Q2, or via P9), when it's within
--     the tutor's configured lead time
--
-- reminders.invoice_id becomes nullable and a new session_id column is
-- added, with a check that exactly one of the two is ever set — same
-- table, same RLS-select-only/no-direct-write shape, same "insert-to-claim
-- before sending" dedup idea as the existing invoice-reminder unique
-- constraint, just scoped to session_id instead for these two kinds.

alter table tutors
  -- Capped at 336h (14 days) to match the cron job's lookahead window
  -- (app/api/cron/reminders/route.ts) — see lib/reminders.ts's
  -- SESSION_REMINDER_MAX_LEAD_HOURS for why the two must stay in sync.
  add column session_reminder_lead_hours integer not null default 24
    check (session_reminder_lead_hours >= 0 and session_reminder_lead_hours <= 336);

-- Extends the existing reminder_templates jsonb (P5) with two more keys
-- rather than a parallel templates column — same editable-template
-- infrastructure (ReminderTemplatesForm, interpolateTemplate) now covers
-- session-triggered emails too. New default for future tutors, and
-- backfilled onto every existing tutor row that doesn't have these keys
-- yet (a fresh `alter ... add column ... default` only applies the
-- default going forward for a jsonb blob like this, not retroactively).
alter table tutors alter column reminder_templates set default '{
  "offset_0": {
    "subject": "Invoice for {{student}} is due today",
    "body": "Hi! Just a friendly note that the invoice for {{student}}''s sessions is due today. Thanks so much for tutoring with {{tutor}} — pay whenever is convenient: {{link}}"
  },
  "offset_3": {
    "subject": "Quick reminder: invoice for {{student}}",
    "body": "Hi! Floating this back to the top — the invoice for {{student}} was due a few days ago, no rush at all. Link: {{link}}"
  },
  "offset_7": {
    "subject": "Following up on {{student}}''s invoice",
    "body": "Hi! Circling back one more time on the invoice for {{student}} from last week. Let me know if you have any questions — happy to help. Link: {{link}}"
  },
  "booking_confirmation": {
    "subject": "You''re booked with {{tutor}}",
    "body": "Hi! This confirms {{student}}''s session with {{tutor}} on {{when}}. We''ll send a reminder beforehand — see you then!"
  },
  "session_reminder": {
    "subject": "Reminder: {{student}}''s session is coming up",
    "body": "Hi! Just a heads up that {{student}}''s session with {{tutor}} is coming up on {{when}}. Let {{tutor}} know if anything''s changed."
  }
}'::jsonb;

update tutors
set reminder_templates = reminder_templates || '{
  "booking_confirmation": {
    "subject": "You''re booked with {{tutor}}",
    "body": "Hi! This confirms {{student}}''s session with {{tutor}} on {{when}}. We''ll send a reminder beforehand — see you then!"
  },
  "session_reminder": {
    "subject": "Reminder: {{student}}''s session is coming up",
    "body": "Hi! Just a heads up that {{student}}''s session with {{tutor}} is coming up on {{when}}. Let {{tutor}} know if anything''s changed."
  }
}'::jsonb
where not (reminder_templates ? 'booking_confirmation');

alter table reminders
  alter column invoice_id drop not null,
  add column session_id uuid references sessions (id) on delete cascade,
  add column kind text not null default 'invoice_reminder'
    check (kind in ('invoice_reminder', 'booking_confirmation', 'session_reminder')),
  add constraint reminders_exactly_one_parent check (
    (invoice_id is not null and session_id is null) or (invoice_id is null and session_id is not null)
  );

create index reminders_session_id_idx on reminders (session_id);

-- The existing (invoice_id, template_key) unique constraint is left
-- untouched — Postgres unique constraints already treat NULL as
-- non-conflicting, so it never matched session-linked rows (invoice_id
-- null) even now that they share the table; nothing to narrow. Add the
-- session-side equivalent: at most one 'booking_confirmation' and one
-- 'session_reminder' per session (kind doubles as the dedup key there,
-- template_key stays required for interpolation lookups but isn't part of
-- this constraint the way it is on the invoice side, since a session only
-- ever gets each kind once — no cadence/offset sequence to distinguish).
create unique index reminders_session_kind_unique on reminders (session_id, kind) where session_id is not null;

drop policy "reminders_select_own" on reminders;

create policy "reminders_select_own" on reminders
  for select using (
    (invoice_id is not null and invoice_id in (
      select id from invoices
      where tutor_id in (select id from tutors where auth_user_id = auth.uid())
    ))
    or (session_id is not null and session_id in (
      select id from sessions
      where tutor_id in (select id from tutors where auth_user_id = auth.uid())
    ))
  );

-- No new SECURITY DEFINER write path needed here (unlike log_reminder for
-- invoices): both flows that write a session-linked reminder row already
-- run with service-role access — the daily cron job (like the existing
-- invoice-reminder job) and Q2's confirmBookingLinkAction, which already
-- uses createAdminClient() in the same function for the tutor-notification
-- lookup. Using that same admin client for the reminders insert-to-claim
-- avoids granting a new function to `anon` for what would otherwise be an
-- unauthenticated, unvalidated write (Q2's confirm flow has no tutor
-- session to re-derive authorization from, the same reason it needed the
-- admin client in the first place). There's no manual "send session
-- reminder now" UI in this build, so no authenticated-tutor call site
-- needs its own grant either.
