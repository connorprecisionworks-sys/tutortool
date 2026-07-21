-- Rollback for 20260720090000_f1_feedback_widget.sql

drop policy if exists "founder_feedback_tutor_select_own" on founder_feedback;
drop policy if exists "founder_feedback_tutor_insert_own" on founder_feedback;

drop index if exists founder_feedback_tutor_id_idx;

-- Backfill before restoring NOT NULL: any real in_app rows submitted with
-- no category chosen (tag is null) would otherwise violate the restored
-- constraint below.
update founder_feedback set tag = 'feature' where tag is null;

alter table founder_feedback drop constraint if exists founder_feedback_tag_check;
alter table founder_feedback add constraint founder_feedback_tag_check
  check (tag = any (array['bug', 'feature', 'ux', 'pricing', 'praise']));
alter table founder_feedback alter column tag set not null;

alter table founder_feedback drop column if exists context;
alter table founder_feedback drop column if exists tutor_id;
