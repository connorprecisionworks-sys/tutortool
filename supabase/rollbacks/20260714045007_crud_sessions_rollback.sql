-- Rollback for 20260714045007_crud_sessions.sql

revoke execute on function update_session(uuid, date, time, integer, integer, text, text) from authenticated;
revoke execute on function delete_session(uuid) from authenticated;

drop function if exists delete_session(uuid);
drop function if exists update_session(uuid, date, time, integer, integer, text, text);

create policy "sessions_update_own" on sessions
  for update using (
    tutor_id in (select id from tutors where auth_user_id = auth.uid())
  ) with check (
    tutor_id in (select id from tutors where auth_user_id = auth.uid())
    and client_id in (
      select id from clients
      where tutor_id in (select id from tutors where auth_user_id = auth.uid())
    )
  );

create policy "sessions_delete_own" on sessions
  for delete using (
    tutor_id in (select id from tutors where auth_user_id = auth.uid())
    and status = 'logged'
  );
