-- Rollback for 20260714050200_crud_students.sql

revoke execute on function delete_student(uuid) from authenticated;
drop function if exists delete_student(uuid);

create policy "clients_delete_own" on clients
  for delete using (tutor_id in (select id from tutors where auth_user_id = auth.uid()));
