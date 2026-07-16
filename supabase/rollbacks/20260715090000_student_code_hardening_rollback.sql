-- Rollback for 20260715090000_student_code_hardening.sql
--
-- Lossy like the redeemed_by column drop in invites_polish_rollback.sql:
-- the open/used distinction collapsed into 'active' can't be reconstructed,
-- so every 'active' row maps back to 'open'. parent_name/parent_email
-- captured on parent_students at redemption time are dropped, not moved
-- back onto invites (a reusable code has many redeemers now; there's no
-- single row to put them back on).

revoke execute on function create_student(text, text, text, text, rate_type, integer, boolean, integer, boolean, text, text) from authenticated;
drop function if exists create_student(text, text, text, text, rate_type, integer, boolean, integer, boolean, text, text);

create or replace function create_invite(p_student_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
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

drop function revoke_invite(uuid);

create function revoke_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update invites
  set status = 'revoked'
  where id = p_invite_id
    and tutor_id = current_tutor_id()
    and status = 'open';

  if not found then
    raise exception 'Invite not found or not revocable.';
  end if;
end;
$$;

drop function regenerate_invite(uuid);

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

revoke execute on function create_invite(uuid) from public;
revoke execute on function revoke_invite(uuid) from public;
revoke execute on function regenerate_invite(uuid) from public;
revoke execute on function redeem_invite(text) from public;
grant execute on function create_invite(uuid) to authenticated;
grant execute on function revoke_invite(uuid) to authenticated;
grant execute on function regenerate_invite(uuid) to authenticated;
grant execute on function redeem_invite(text) to authenticated;

drop index if exists invites_one_active_per_student;

alter table invites
  add column redeemed_by uuid references users (id) on delete set null,
  add column redeemed_by_name text,
  add column redeemed_by_email text;

update invites set status = 'open' where status = 'active';

alter table invites drop constraint invites_status_check;
alter table invites add constraint invites_status_check check (status in ('open', 'used', 'revoked'));
alter table invites alter column status set default 'open';

alter table parent_students
  drop column if exists parent_name,
  drop column if exists parent_email;
