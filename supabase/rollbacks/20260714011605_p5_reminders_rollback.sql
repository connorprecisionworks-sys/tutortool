-- Rollback for 20260714011605_p5_reminders.sql

alter table tutors drop column if exists reminder_templates;

drop function if exists log_reminder(uuid, text, text);

drop policy if exists "reminders_select_own" on reminders;

drop index if exists reminders_invoice_id_idx;

drop table if exists reminders;
