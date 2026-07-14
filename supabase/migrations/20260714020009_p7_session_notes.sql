-- P7: session notes with a share toggle + parent-safe sessions read path.
--
-- Privacy note: RLS controls row visibility, not column visibility. A plain
-- "parents can select their child's sessions" policy on the base `sessions`
-- table would let a parent query effective_rate_cents/travel_rate_cents/
-- bill_travel directly via REST even if the UI never renders them — exactly
-- the "rate internals" section 12 says parents must never see. So parents
-- get a dedicated view (parent_visible_sessions) exposing only the safe
-- columns, defined with security_invoker = false so it runs as the view
-- owner (bypassing the base table's RLS entirely) and applies its own
-- is_parent_of_student() filter instead — tutors keep using the base
-- `sessions` table unchanged via their existing RLS policies.

create table session_notes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references sessions (id) on delete cascade,
  tutor_id uuid not null references tutors (id) on delete cascade,
  body text not null,
  shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index session_notes_session_id_idx on session_notes (session_id);
create index session_notes_tutor_id_idx on session_notes (tutor_id);

alter table session_notes enable row level security;

create function is_parent_of_session(p_session_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from sessions s
    where s.id = p_session_id and is_parent_of_student(s.client_id)
  )
$$;

revoke execute on function is_parent_of_session(uuid) from public;
grant execute on function is_parent_of_session(uuid) to authenticated;

create policy "session_notes_select_own" on session_notes
  for select using (tutor_id in (select id from tutors where auth_user_id = auth.uid()));

-- Unshared notes are tutor-only: this is the ONLY policy granting parents
-- any access, and it requires shared = true.
create policy "session_notes_select_parent" on session_notes
  for select using (shared = true and is_parent_of_session(session_id));

create policy "session_notes_insert_own" on session_notes
  for insert with check (
    tutor_id in (select id from tutors where auth_user_id = auth.uid())
    and session_id in (
      select id from sessions
      where tutor_id in (select id from tutors where auth_user_id = auth.uid())
    )
  );

-- WITH CHECK re-validates session_id (not just tutor_id) so a tutor can't
-- UPDATE their own note's session_id to point at another tutor's session —
-- the same ownership check the insert policy already has. Without this, an
-- UPDATE (or an upsert's ON CONFLICT DO UPDATE path) could reassign/leak
-- note content onto an unrelated family's session.
create policy "session_notes_update_own" on session_notes
  for update using (tutor_id in (select id from tutors where auth_user_id = auth.uid()))
  with check (
    tutor_id in (select id from tutors where auth_user_id = auth.uid())
    and session_id in (
      select id from sessions
      where tutor_id in (select id from tutors where auth_user_id = auth.uid())
    )
  );

create policy "session_notes_delete_own" on session_notes
  for delete using (tutor_id in (select id from tutors where auth_user_id = auth.uid()));

create view parent_visible_sessions
with (security_invoker = false)
as
select
  id,
  tutor_id,
  client_id,
  occurred_on,
  start_time,
  duration_minutes,
  travel_minutes,
  location,
  status,
  created_at
from sessions
where is_parent_of_student(client_id);

grant select on parent_visible_sessions to authenticated;
