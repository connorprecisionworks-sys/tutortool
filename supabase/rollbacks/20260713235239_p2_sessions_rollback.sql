-- Rollback for 20260713235239_p2_sessions.sql

drop policy if exists "sessions_delete_own" on sessions;
drop policy if exists "sessions_update_own" on sessions;
drop policy if exists "sessions_insert_own" on sessions;
drop policy if exists "sessions_select_own" on sessions;

drop index if exists sessions_status_idx;
drop index if exists sessions_client_id_idx;
drop index if exists sessions_tutor_id_idx;

drop table if exists sessions;

drop type if exists session_status;
