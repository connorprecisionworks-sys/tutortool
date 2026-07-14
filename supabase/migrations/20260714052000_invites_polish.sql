-- Invite-flow polish: safer code alphabet + "who redeemed this" tracking.
--
-- 1. create_invite's original code generator sliced an md5 hex digest,
--    which only ever produces 0-9 and a-f — not a real alphanumeric
--    charset, and it includes '0' and '1' (visually ambiguous with O/I)
--    while never using O/I at all (not hex digits). Replaced with a proper
--    32-character safe alphabet excluding O/0/I/1 entirely, so every code
--    a parent has to type back in reads unambiguously over phone/text.
--
-- 2. The tutor could see an invite's status flip to 'used' but had no way
--    to see WHICH parent redeemed it — `users` only grants
--    users_select_own, so a tutor can't join against the redeeming
--    parent's row directly. Denormalizing the parent's name/email onto
--    the invites row at redemption time (captured once, in the same
--    transaction as the status flip) avoids adding a new cross-table
--    read path just for this.

alter table invites
  add column redeemed_by uuid references users (id) on delete set null,
  add column redeemed_by_name text,
  add column redeemed_by_email text;

create or replace function create_invite(p_student_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- excludes O, 0, I, 1
  v_code text;
  v_attempts integer := 0;
  i integer;
begin
  if v_tutor_id is null then
    raise exception 'Not a tutor.';
  end if;

  if not exists (select 1 from clients where id = p_student_id and tutor_id = v_tutor_id) then
    raise exception 'Student not found.';
  end if;

  loop
    v_code := '';
    for i in 1..7 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::integer, 1);
    end loop;

    begin
      insert into invites (tutor_id, student_id, code, status)
      values (v_tutor_id, p_student_id, v_code, 'open');
      return v_code;
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts > 5 then
        raise exception 'Could not generate a unique invite code — try again.';
      end if;
    end;
  end loop;
end;
$$;

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
  v_student_id uuid;
begin
  select id, name, email into v_parent_user_id, v_parent_name, v_parent_email
  from users where auth_user_id = auth.uid() and role = 'parent';
  if v_parent_user_id is null then
    raise exception 'Not a parent account.';
  end if;

  -- Single atomic guarded UPDATE (not a prior SELECT) so two concurrent
  -- redemptions of the same code can't both pass an "is it still open"
  -- check before either commits — the loser's UPDATE simply matches zero
  -- rows once the winner's commit is visible, same pattern as
  -- send_invoice/mark_invoice_paid in P3.
  update invites
  set status = 'used', redeemed_by = v_parent_user_id, redeemed_by_name = v_parent_name, redeemed_by_email = v_parent_email
  where code = p_code
    and status = 'open'
    and (expires_at is null or expires_at > now())
  returning student_id into v_student_id;

  if v_student_id is null then
    raise exception 'Invalid or expired invite code.';
  end if;

  insert into parent_students (parent_user_id, student_id)
  values (v_parent_user_id, v_student_id)
  on conflict (parent_user_id, student_id) do nothing;

  return v_student_id;
end;
$$;

-- create or replace preserves the existing grants from P6, but re-assert
-- them explicitly since this migration changes both function bodies.
revoke execute on function create_invite(uuid) from public;
revoke execute on function redeem_invite(text) from public;
grant execute on function create_invite(uuid) to authenticated;
grant execute on function redeem_invite(text) to authenticated;

-- New: regenerate an open invite in one step (revoke it, issue a fresh
-- code for the same student) instead of two separate tutor actions.
create function regenerate_invite(p_invite_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
  v_student_id uuid;
begin
  if v_tutor_id is null then
    raise exception 'Not a tutor.';
  end if;

  update invites
  set status = 'revoked'
  where id = p_invite_id and tutor_id = v_tutor_id and status = 'open'
  returning student_id into v_student_id;

  if v_student_id is null then
    raise exception 'Invite not found or not open.';
  end if;

  return create_invite(v_student_id);
end;
$$;

revoke execute on function regenerate_invite(uuid) from public;
grant execute on function regenerate_invite(uuid) to authenticated;
