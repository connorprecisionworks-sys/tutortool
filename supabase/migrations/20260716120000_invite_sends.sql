-- Tracks each time a tutor prepares/sends an invite for a *named* parent
-- (copy-message or email), so the student page can show "pending" invites
-- distinct from the anonymous, reusable Student Code itself. A send is
-- "pending" until a parent_students row exists for the same student with a
-- matching (case-insensitive) email — computed at read time in the app,
-- not stored here, so it can never drift out of sync the way a stored
-- status flag could.
--
-- Same pattern as `invites`: RLS is select-only, scoped to the owning
-- tutor; the sole write path is the SECURITY DEFINER log_invite_send()
-- below, which re-verifies student ownership itself rather than trusting a
-- client-supplied tutor_id in an insert policy's WITH CHECK.
create table invite_sends (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutors (id) on delete cascade,
  student_id uuid not null references clients (id) on delete cascade,
  parent_name text,
  parent_email text not null,
  channel text not null check (channel in ('copy', 'email')),
  sent_at timestamptz not null default now(),
  unique (student_id, parent_email)
);

create index invite_sends_student_id_idx on invite_sends (student_id);
create index invite_sends_tutor_id_idx on invite_sends (tutor_id);

alter table invite_sends enable row level security;

create policy "invite_sends_select_own" on invite_sends
  for select using (tutor_id in (select id from tutors where auth_user_id = auth.uid()));

-- No insert/update/delete policy: log_invite_send() is the only sanctioned write.

create function log_invite_send(p_student_id uuid, p_parent_name text, p_parent_email text, p_channel text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
begin
  if v_tutor_id is null then
    raise exception 'Not a tutor.';
  end if;

  if p_parent_email is null or btrim(p_parent_email) = '' then
    raise exception 'Parent email is required.';
  end if;

  if not exists (select 1 from clients where id = p_student_id and tutor_id = v_tutor_id) then
    raise exception 'Student not found.';
  end if;

  insert into invite_sends (tutor_id, student_id, parent_name, parent_email, channel)
  values (v_tutor_id, p_student_id, nullif(btrim(p_parent_name), ''), lower(btrim(p_parent_email)), p_channel)
  on conflict (student_id, parent_email)
  do update set parent_name = excluded.parent_name, channel = excluded.channel, sent_at = now();
end;
$$;

revoke execute on function log_invite_send(uuid, text, text, text) from public;
grant execute on function log_invite_send(uuid, text, text, text) to authenticated;
