-- Restores the pre-D9 default copy for any tutor whose templates still
-- exactly match D9's new copy (i.e. were backfilled or created after D9,
-- never hand-edited since) — same "only touch untouched defaults" guard
-- as the forward migration, so a tutor's real customization survives a
-- rollback too. 'invite_parent' has no pre-D9 equivalent, so it's dropped
-- outright rather than "restored".

update tutors
set reminder_templates = jsonb_set(
  reminder_templates, '{offset_0}',
  '{"subject":"Invoice for {{student}} is due today","body":"Hi! Just a friendly note that the invoice for {{student}}''s sessions is due today. Thanks so much for tutoring with {{tutor}} — pay whenever is convenient: {{link}}"}'::jsonb
)
where reminder_templates->'offset_0'->>'body' =
  'Hi! {{tutor}} has an invoice ready for {{student}} — {{amount}}, due today. Pay anytime here: {{link}}';

update tutors
set reminder_templates = jsonb_set(
  reminder_templates, '{offset_3}',
  '{"subject":"Quick reminder: invoice for {{student}}","body":"Hi! Floating this back to the top — the invoice for {{student}} was due a few days ago, no rush at all. Link: {{link}}"}'::jsonb
)
where reminder_templates->'offset_3'->>'body' =
  'Hi! Just floating this back up — {{student}}''s invoice ({{amount}}) was due a few days ago. No rush, pay whenever works: {{link}}';

update tutors
set reminder_templates = jsonb_set(
  reminder_templates, '{offset_7}',
  '{"subject":"Following up on {{student}}''s invoice","body":"Hi! Circling back one more time on the invoice for {{student}} from last week. Let me know if you have any questions — happy to help. Link: {{link}}"}'::jsonb
)
where reminder_templates->'offset_7'->>'body' =
  'Hi! One more friendly check-in on {{student}}''s invoice ({{amount}}), due last week. Let {{tutor}} know if anything''s off: {{link}}';

update tutors
set reminder_templates = jsonb_set(
  reminder_templates, '{booking_confirmation}',
  '{"subject":"You''re booked with {{tutor}}","body":"Hi! This confirms {{student}}''s session with {{tutor}} on {{when}}. We''ll send a reminder beforehand — see you then!"}'::jsonb
)
where reminder_templates->'booking_confirmation'->>'body' =
  'You''re all set! {{student}}''s session with {{tutor}} is confirmed for {{when}}. See the details here: {{link}}';

update tutors
set reminder_templates = jsonb_set(
  reminder_templates, '{session_reminder}',
  '{"subject":"Reminder: {{student}}''s session is coming up","body":"Hi! Just a heads up that {{student}}''s session with {{tutor}} is coming up on {{when}}. Let {{tutor}} know if anything''s changed."}'::jsonb
)
where reminder_templates->'session_reminder'->>'body' =
  'Just a heads up: {{student}}''s session with {{tutor}} is coming up on {{when}}. Let {{tutor}} know if anything''s changed.';

update tutors
set reminder_templates = reminder_templates - 'invite_parent';

-- The forward migration repointed the reminder_templates column DEFAULT at
-- D9's new copy (via `alter column ... set default`); without reversing it
-- here too, any tutor row created after a rollback would still start from
-- the new copy even though every existing row was just restored to old.
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

alter table tutors drop column if exists custom_email_templates;
alter table tutors drop column if exists notification_settings;
