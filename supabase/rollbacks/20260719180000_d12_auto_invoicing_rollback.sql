-- Rollback D12: auto-send invoices.

revoke execute on function run_client_auto_invoice(uuid) from service_role;
drop function if exists run_client_auto_invoice(uuid);

drop table if exists auto_invoice_runs;

alter table clients
  drop column if exists auto_invoice_enabled,
  drop column if exists auto_invoice_trigger,
  drop column if exists auto_invoice_next_date;

alter table invoices drop column if exists auto_generated;

update tutors
set reminder_templates = reminder_templates - 'auto_invoice_sent';

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
