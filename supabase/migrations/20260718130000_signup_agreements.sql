-- Clickwrap consent at signup + version-gated re-acceptance.
--
-- One row per acceptance EVENT, not per document — the checkbox is a
-- single "I agree to the Terms of Service and Privacy Policy" clickwrap,
-- so one row captures both versions accepted together, matching what the
-- user actually did in one action. Keyed by auth_user_id directly (same
-- shape as users.auth_user_id/tutors.auth_user_id) rather than users.id,
-- so requireTutor/requireParent and the signup action can record/check it
-- with the auth user id they already have in hand, no extra join.
--
-- Immutable audit record: no update/delete policy. This is legal proof of
-- consent — nothing should ever be able to rewrite or erase a past
-- acceptance, only add a new one.
create table agreements (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  accepted_at timestamptz not null default now()
);

create index agreements_auth_user_id_idx on agreements (auth_user_id, accepted_at desc);

alter table agreements enable row level security;

create policy "agreements_select_own" on agreements
  for select using (auth_user_id = auth.uid());

create policy "agreements_insert_own" on agreements
  for insert with check (auth_user_id = auth.uid());

-- No update/delete policy — see note above.
