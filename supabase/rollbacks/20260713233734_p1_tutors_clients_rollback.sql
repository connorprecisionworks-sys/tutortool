-- Rollback for 20260713233734_p1_tutors_clients.sql

drop policy if exists "clients_delete_own" on clients;
drop policy if exists "clients_update_own" on clients;
drop policy if exists "clients_insert_own" on clients;
drop policy if exists "clients_select_own" on clients;
drop policy if exists "tutors_update_own" on tutors;
drop policy if exists "tutors_insert_own" on tutors;
drop policy if exists "tutors_select_own" on tutors;

drop index if exists clients_tutor_id_idx;

drop table if exists clients;
drop table if exists tutors;

drop type if exists rate_type;
