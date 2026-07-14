-- Rollback for 20260714020009_p7_session_notes.sql

drop view if exists parent_visible_sessions;

drop policy if exists "session_notes_delete_own" on session_notes;
drop policy if exists "session_notes_update_own" on session_notes;
drop policy if exists "session_notes_insert_own" on session_notes;
drop policy if exists "session_notes_select_parent" on session_notes;
drop policy if exists "session_notes_select_own" on session_notes;

drop function if exists is_parent_of_session(uuid);

drop index if exists session_notes_tutor_id_idx;
drop index if exists session_notes_session_id_idx;
drop table if exists session_notes;
