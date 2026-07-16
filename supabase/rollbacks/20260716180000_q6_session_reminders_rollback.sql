-- Rollback for 20260716180000_q6_session_reminders.sql

-- Restores the column default only — leaves any already-backfilled
-- booking_confirmation/session_reminder keys on existing tutor rows as
-- harmless unused jsonb fields rather than risking a data-mutating
-- rollback to strip them back out.
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
  }
}'::jsonb;

drop policy if exists "reminders_select_own" on reminders;

create policy "reminders_select_own" on reminders
  for select using (
    invoice_id in (
      select id from invoices
      where tutor_id in (select id from tutors where auth_user_id = auth.uid())
    )
  );

-- reminders_invoice_template_unique was never touched by the forward
-- migration (see its comment — Postgres unique constraints already treat
-- NULL as non-conflicting, so nothing needed narrowing), so there's
-- nothing to restore here either.
drop index if exists reminders_session_kind_unique;

alter table reminders drop constraint if exists reminders_exactly_one_parent;

drop index if exists reminders_session_id_idx;

-- Any session-linked reminder rows (invoice_id null) can't survive
-- invoice_id becoming NOT NULL again — same data-loss-on-rollback
-- tradeoff accepted throughout this build's rollbacks (e.g. dropping a
-- column outright), not something to preserve across a genuine rollback.
delete from reminders where invoice_id is null;

alter table reminders
  drop column if exists kind,
  drop column if exists session_id,
  alter column invoice_id set not null;

alter table tutors drop column if exists session_reminder_lead_hours;
