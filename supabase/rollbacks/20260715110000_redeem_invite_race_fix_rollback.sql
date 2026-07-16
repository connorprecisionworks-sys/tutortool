-- Rollback for 20260715110000_redeem_invite_race_fix.sql

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

  select * into v_invite from invites where code = p_code;

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
  on conflict (parent_user_id, student_id) do nothing;

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

  if not exists (select 1 from clients where id = p_student_id and tutor_id = v_tutor_id) then
    raise exception 'Student not found.';
  end if;

  update invites
  set status = 'revoked'
  where student_id = p_student_id and tutor_id = v_tutor_id and status = 'active';

  return create_invite(p_student_id);
end;
$$;

revoke execute on function redeem_invite(text) from public;
revoke execute on function regenerate_invite(uuid) from public;
grant execute on function redeem_invite(text) to authenticated;
grant execute on function regenerate_invite(uuid) to authenticated;
