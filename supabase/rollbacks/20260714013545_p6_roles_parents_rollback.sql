-- Rollback for 20260714013545_p6_roles_parents.sql

drop policy if exists "clients_select_parent" on clients;

drop function if exists redeem_invite(text);
drop function if exists revoke_invite(uuid);
drop function if exists create_invite(uuid);

drop policy if exists "invites_select_own" on invites;
drop index if exists invites_code_idx;
drop index if exists invites_tutor_id_idx;
drop table if exists invites;

drop policy if exists "parent_students_select_own" on parent_students;
drop function if exists is_parent_of_student(uuid);
drop function if exists is_tutor_of_client(uuid);
drop index if exists parent_students_student_id_idx;
drop index if exists parent_students_parent_user_id_idx;
drop table if exists parent_students;

alter table clients drop column if exists class_id;

drop policy if exists "classes_delete_own" on classes;
drop policy if exists "classes_update_own" on classes;
drop policy if exists "classes_insert_own" on classes;
drop policy if exists "classes_select_own" on classes;
drop index if exists classes_tutor_id_idx;
drop table if exists classes;

drop policy if exists "users_update_own" on users;
drop policy if exists "users_insert_own" on users;
drop policy if exists "users_select_own" on users;
drop index if exists users_auth_user_id_idx;
drop table if exists users;
