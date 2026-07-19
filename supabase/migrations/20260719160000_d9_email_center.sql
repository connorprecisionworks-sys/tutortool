-- D9: email center.
-- 1. notification_settings: per-tutor on/off switches for automatic sends
--    (which alerts the tutor gets, which go to parents). Absent key means
--    "on" everywhere it's read (existing tutors get today's always-on
--    behavior unchanged until they explicitly turn something off).
-- 2. custom_email_templates: tutor-authored templates beyond the 6 system
--    ones in reminder_templates — an array (not fixed keys) since tutors
--    can create any number. Not wired to any automatic send trigger (there
--    is no "custom" trigger point); these are for the tutor's own preview/
--    authoring use for now.
-- reminder_templates itself is untouched — its jsonb shape already accepts
-- new keys with no migration needed, and the app layer now also stores an
-- "invite_parent" key there (replacing the hardcoded lib/invite-email.ts
-- builder) so the invite email becomes tutor-editable like the other 5.
--
-- The new copy below is duplicated verbatim in lib/email-templates.ts
-- (the fallback used when a key is missing, e.g. a brand-new tutor) —
-- keep the two in sync if this copy ever changes again.

alter table tutors add column notification_settings jsonb not null default '{}'::jsonb;
alter table tutors add column custom_email_templates jsonb not null default '[]'::jsonb;

-- Modernize copy for tutors still on the exact pre-D9 defaults (untouched
-- by a real edit) so existing accounts get the on-brand rewrite too,
-- without ever overwriting anything a tutor actually customized.
update tutors
set reminder_templates = jsonb_set(
  reminder_templates, '{offset_0}',
  '{"subject":"{{student}}''s invoice is ready","body":"Hi! {{tutor}} has an invoice ready for {{student}} — {{amount}}, due today. Pay anytime here: {{link}}"}'::jsonb
)
where reminder_templates->'offset_0'->>'body' =
  'Hi! Just a friendly note that the invoice for {{student}}''s sessions is due today. Thanks so much for tutoring with {{tutor}} — pay whenever is convenient: {{link}}';

update tutors
set reminder_templates = jsonb_set(
  reminder_templates, '{offset_3}',
  '{"subject":"Quick nudge — {{student}}''s invoice","body":"Hi! Just floating this back up — {{student}}''s invoice ({{amount}}) was due a few days ago. No rush, pay whenever works: {{link}}"}'::jsonb
)
where reminder_templates->'offset_3'->>'body' =
  'Hi! Floating this back to the top — the invoice for {{student}} was due a few days ago, no rush at all. Link: {{link}}';

update tutors
set reminder_templates = jsonb_set(
  reminder_templates, '{offset_7}',
  '{"subject":"Following up — {{student}}''s invoice","body":"Hi! One more friendly check-in on {{student}}''s invoice ({{amount}}), due last week. Let {{tutor}} know if anything''s off: {{link}}"}'::jsonb
)
where reminder_templates->'offset_7'->>'body' =
  'Hi! Circling back one more time on the invoice for {{student}} from last week. Let me know if you have any questions — happy to help. Link: {{link}}';

-- No trailing "See the details here: {{link}}" — that dead-ends in a bare
-- colon for any tutor without a public handle set (link renders empty; the
-- CTA button below already conditionally carries the link when present).
update tutors
set reminder_templates = jsonb_set(
  reminder_templates, '{booking_confirmation}',
  '{"subject":"You''re booked with {{tutor}}","body":"You''re all set! {{student}}''s session with {{tutor}} is confirmed for {{when}}."}'::jsonb
)
where reminder_templates->'booking_confirmation'->>'body' =
  'Hi! This confirms {{student}}''s session with {{tutor}} on {{when}}. We''ll send a reminder beforehand — see you then!';

update tutors
set reminder_templates = jsonb_set(
  reminder_templates, '{session_reminder}',
  '{"subject":"Reminder — {{student}}''s session is coming up","body":"Just a heads up: {{student}}''s session with {{tutor}} is coming up on {{when}}. Let {{tutor}} know if anything''s changed."}'::jsonb
)
where reminder_templates->'session_reminder'->>'body' =
  'Hi! Just a heads up that {{student}}''s session with {{tutor}} is coming up on {{when}}. Let {{tutor}} know if anything''s changed.';

-- 'invite_parent' never existed as a reminder_templates key before D9 (the
-- invite email was a hardcoded, non-editable builder) — seed it for every
-- existing tutor so it's immediately editable, same as the other 5.
update tutors
set reminder_templates = jsonb_set(
  reminder_templates, '{invite_parent}',
  '{"subject":"You''re invited to Slate for {{student}}","body":"{{tutor}} uses Slate to share {{student}}''s sessions, notes, schedule, and invoices with you. Join here: {{link}} (or enter code {{code}})."}'::jsonb
)
where not (reminder_templates ? 'invite_parent');

-- The column's own DEFAULT (set by the P5/Q6 migrations) still carries the
-- pre-D9 copy — without updating it, every tutor row created after this
-- migration would start with old copy already "present" for every key, so
-- lib/email-templates.ts's resolveSystemTemplate() (which only falls back
-- to its own new-copy default when a key is genuinely *missing*) would
-- never actually apply the rewrite to a new tutor.
alter table tutors alter column reminder_templates set default '{
  "offset_0": {
    "subject": "{{student}}''s invoice is ready",
    "body": "Hi! {{tutor}} has an invoice ready for {{student}} — {{amount}}, due today. Pay anytime here: {{link}}"
  },
  "offset_3": {
    "subject": "Quick nudge — {{student}}''s invoice",
    "body": "Hi! Just floating this back up — {{student}}''s invoice ({{amount}}) was due a few days ago. No rush, pay whenever works: {{link}}"
  },
  "offset_7": {
    "subject": "Following up — {{student}}''s invoice",
    "body": "Hi! One more friendly check-in on {{student}}''s invoice ({{amount}}), due last week. Let {{tutor}} know if anything''s off: {{link}}"
  },
  "booking_confirmation": {
    "subject": "You''re booked with {{tutor}}",
    "body": "You''re all set! {{student}}''s session with {{tutor}} is confirmed for {{when}}."
  },
  "session_reminder": {
    "subject": "Reminder — {{student}}''s session is coming up",
    "body": "Just a heads up: {{student}}''s session with {{tutor}} is coming up on {{when}}. Let {{tutor}} know if anything''s changed."
  },
  "invite_parent": {
    "subject": "You''re invited to Slate for {{student}}",
    "body": "{{tutor}} uses Slate to share {{student}}''s sessions, notes, schedule, and invoices with you. Join here: {{link}} (or enter code {{code}})."
  }
}'::jsonb;
