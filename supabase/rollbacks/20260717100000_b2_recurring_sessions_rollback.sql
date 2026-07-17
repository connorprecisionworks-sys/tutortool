drop function if exists end_recurring_series(uuid, date, text);

drop policy if exists "sessions_insert_own" on sessions;

create policy "sessions_insert_own" on sessions
  for insert with check (
    tutor_id in (select id from tutors where auth_user_id = auth.uid())
    and client_id in (
      select id from clients where tutor_id in (select id from tutors where auth_user_id = auth.uid())
    )
    and package_id is null
  );

drop index if exists sessions_recurring_occurrence_unique_idx;

alter table sessions drop column if exists recurring_session_id;

drop table if exists recurring_sessions;
