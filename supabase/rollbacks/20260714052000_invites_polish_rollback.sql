-- Rollback for 20260714052000_invites_polish.sql

revoke execute on function regenerate_invite(uuid) from authenticated;
drop function if exists regenerate_invite(uuid);

create or replace function create_invite(p_student_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
  v_code text;
  v_attempts integer := 0;
begin
  if v_tutor_id is null then
    raise exception 'Not a tutor.';
  end if;

  if not exists (select 1 from clients where id = p_student_id and tutor_id = v_tutor_id) then
    raise exception 'Student not found.';
  end if;

  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 7));
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
  v_student_id uuid;
begin
  select id into v_parent_user_id from users where auth_user_id = auth.uid() and role = 'parent';
  if v_parent_user_id is null then
    raise exception 'Not a parent account.';
  end if;

  update invites
  set status = 'used'
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

revoke execute on function create_invite(uuid) from public;
revoke execute on function redeem_invite(text) from public;
grant execute on function create_invite(uuid) to authenticated;
grant execute on function redeem_invite(text) to authenticated;

alter table invites
  drop column if exists redeemed_by_email,
  drop column if exists redeemed_by_name,
  drop column if exists redeemed_by;
