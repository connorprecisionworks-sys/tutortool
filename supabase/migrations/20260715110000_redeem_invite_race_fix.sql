-- /review of 20260715090000_student_code_hardening.sql surfaced a real
-- TOCTOU race: redeem_invite's `select * into v_invite from invites where
-- code = p_code` (no lock) reads the row, then several statements later
-- inserts into parent_students — a concurrent revoke_invite can commit
-- 'revoked' in between, and the parent still gets linked. This repo's own
-- money_mutation_architecture convention is explicit that a plain
-- SELECT-then-write is a TOCTOU risk under concurrent calls; this fixes it
-- the standard way for a validate-then-act function that isn't a single
-- UPDATE — a locking read.
--
-- `select ... for update` blocks until any concurrent UPDATE on that row
-- commits, then re-reads the post-commit values before this function acts
-- on them. So: redeem_invite grabs the lock first -> revoke_invite waits,
-- redeem proceeds against the still-active code, correct. revoke_invite
-- commits first -> redeem_invite's locked read blocks until it commits,
-- then sees status='revoked' and raises the right error. Either order is
-- now linearizable; the code can no longer be redeemed a beat after being
-- revoked.
--
-- Two more small correctness fixes bundled in since they touch the same
-- functions:
-- 1. redeem_invite's `on conflict (parent_user_id, student_id) do nothing`
--    meant a parent's name/email captured at first redemption never
--    refreshed on re-redemption (e.g. redeeming a second, regenerated code
--    for the same student) even if they'd since changed their `users` row.
--    Now upserts both columns instead.
-- 2. regenerate_invite's own `clients` ownership check was redundant —
--    create_invite() (which it always calls next) performs the identical
--    check and raises the same error, so this was a duplicate query with
--    two copies of the same rule to keep in sync.

create or replace function redeem_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_user_id uuid;
  v_parent_name text;
  v_parent_email text;
  v_invite invites%rowtype;
begin
  select id, name, email into v_parent_user_id, v_parent_name, v_parent_email
  from users where auth_user_id = auth.uid() and role = 'parent';
  if v_parent_user_id is null then
    raise exception 'Not a parent account.';
  end if;

  select * into v_invite from invites where code = p_code for update;

  if v_invite.id is null then
    raise exception 'Invalid code. Double-check with your tutor.';
  end if;

  if v_invite.status = 'revoked' then
    raise exception 'This code has been revoked. Ask your tutor for a new one.';
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at <= now() then
    raise exception 'This code has expired. Ask your tutor for a new one.';
  end if;

  insert into parent_students (parent_user_id, student_id, parent_name, parent_email)
  values (v_parent_user_id, v_invite.student_id, v_parent_name, v_parent_email)
  on conflict (parent_user_id, student_id)
  do update set parent_name = excluded.parent_name, parent_email = excluded.parent_email;

  return v_invite.student_id;
end;
$$;

create or replace function regenerate_invite(p_student_id uuid)
returns text
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

  update invites
  set status = 'revoked'
  where student_id = p_student_id and tutor_id = v_tutor_id and status = 'active';

  -- create_invite() re-verifies student ownership itself (raises 'Student
  -- not found.' if p_student_id isn't this tutor's) — no need to check twice.
  return create_invite(p_student_id);
end;
$$;

revoke execute on function redeem_invite(text) from public;
revoke execute on function regenerate_invite(uuid) from public;
grant execute on function redeem_invite(text) to authenticated;
grant execute on function regenerate_invite(uuid) to authenticated;
