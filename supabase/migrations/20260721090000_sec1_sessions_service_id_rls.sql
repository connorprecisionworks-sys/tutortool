-- Security review finding: sessions_insert_own (last redefined in B2,
-- 20260717100000_b2_recurring_sessions.sql) validates tutor_id, client_id,
-- package_id, and recurring_session_id ownership, but never checks that
-- service_id belongs to the inserting tutor — even though service_id was
-- added back in Q1 (20260716130000_q1_services.sql). Mirrors the exact
-- rls_insert_update_asymmetry/FK-ownership-gap class this codebase has hit
-- before: a malicious authenticated tutor could plant a session row
-- referencing another tutor's service_id (service ids are visible via
-- get_public_tutor_profile), which passes RLS today. No data leak results
-- (RLS still hides the other tutor's own rows), but it lets tutor A block
-- tutor B from ever hard-deleting that service (delete_service's
-- existence guard isn't scoped by tutor) — a cross-tenant griefing/DoS
-- primitive. Fix: add the same ownership check already used for
-- recurring_session_id.
drop policy "sessions_insert_own" on sessions;

create policy "sessions_insert_own" on sessions
  for insert with check (
    tutor_id in (select id from tutors where auth_user_id = auth.uid())
    and client_id in (
      select id from clients where tutor_id in (select id from tutors where auth_user_id = auth.uid())
    )
    and package_id is null
    and (recurring_session_id is null or recurring_session_id in (
      select id from recurring_sessions where tutor_id in (select id from tutors where auth_user_id = auth.uid())
    ))
    and (service_id is null or service_id in (
      select id from services where tutor_id in (select id from tutors where auth_user_id = auth.uid())
    ))
  );
