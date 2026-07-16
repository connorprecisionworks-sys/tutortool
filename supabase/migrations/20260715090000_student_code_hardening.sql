-- Harden the per-student invite into a first-class, persistent "Student
-- Code": reusable across multiple parents instead of single-use, always
-- present (never a student without one), and revocable/regeneratable
-- regardless of redemption history.
--
-- Schema shift: invites.status collapses from ('open','used','revoked') to
-- ('active','revoked'). "Used" stops being a terminal state — a code stays
-- valid for repeat redemptions until a tutor explicitly revokes it. A
-- partial unique index enforces the new invariant this whole feature is
-- built on: at most one active code per student at a time, so "the
-- student's code" is a well-defined, singular thing the UI can render
-- without hunting through history.
--
-- Redemption tracking moves from denormalized columns on invites (which
-- could only ever record ONE redeemer, wrong once a code is reusable) to
-- parent_students itself — the same denormalize-to-avoid-a-new-RLS-policy
-- move invites_polish.sql made, just relocated to the row that's already
-- one-per-redemption. Tutors can already read parent_students for their own
-- students (parent_students_select_own's `or is_tutor_of_client(student_id)`
-- clause, from p6), so this needs no new RLS surface at all.

-- 1. Backfill parent_name/parent_email onto parent_students so existing
--    links (none in this dataset yet, but keep the migration correct for
--    any environment that has some) survive the NOT NULL below.
alter table parent_students
  add column parent_name text,
  add column parent_email text;

update parent_students ps
set parent_name = u.name, parent_email = u.email
from users u
where u.id = ps.parent_user_id and ps.parent_name is null;

alter table parent_students
  alter column parent_name set not null,
  alter column parent_email set not null;

-- 2. Collapse status history before changing the constraint: promote each
--    student's most-recently-created open/used code to 'active' (it's now
--    reusable), demote any older open/used codes for the same student to
--    'revoked' (superseded) so the one-active-per-student index below never
--    sees a conflict. Already-revoked rows are untouched.
with ranked as (
  select id, row_number() over (partition by student_id order by created_at desc) as rn
  from invites
  where status in ('open', 'used')
)
update invites i
set status = case when r.rn = 1 then 'active' else 'revoked' end
from ranked r
where i.id = r.id;

alter table invites drop constraint invites_status_check;
alter table invites add constraint invites_status_check check (status in ('active', 'revoked'));
alter table invites alter column status set default 'active';

create unique index invites_one_active_per_student on invites (student_id) where status = 'active';

-- redeemed_by* only ever recorded the single most recent redeemer, which is
-- now wrong (a reusable code has many) and redundant with parent_students.
alter table invites
  drop column redeemed_by,
  drop column redeemed_by_name,
  drop column redeemed_by_email;

-- 3. Every existing student gets an active code if it doesn't have one —
--    the "never a student without a code" guarantee, applied retroactively.
do $$
declare
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- excludes O, 0, I, 1
  v_code text;
  v_student record;
  v_attempts integer;
  i integer;
begin
  for v_student in
    select c.id as student_id, c.tutor_id
    from clients c
    where not exists (select 1 from invites inv where inv.student_id = c.id and inv.status = 'active')
  loop
    v_attempts := 0;
    loop
      v_code := '';
      for i in 1..7 loop
        v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::integer, 1);
      end loop;
      begin
        insert into invites (tutor_id, student_id, code, status)
        values (v_student.tutor_id, v_student.student_id, v_code, 'active');
        exit;
      exception when unique_violation then
        v_attempts := v_attempts + 1;
        if v_attempts > 5 then
          raise exception 'Could not generate a unique invite code for student %', v_student.student_id;
        end if;
      end;
    end loop;
  end loop;
end;
$$;

-- 4. create_invite: same safe alphabet/length, now issues 'active' codes.
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
      values (v_tutor_id, p_student_id, v_code, 'active');
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

-- 5. revoke_invite/regenerate_invite go student-scoped instead of
--    invite-id-scoped: with at most one active code per student, "the
--    student's code" is what tutors act on, not a specific historical row.
--    revoke_invite no longer requires the code to be unredeemed — a code
--    that parents have already used can still be shut off; existing
--    parent_students rows are untouched by this (they key on student_id,
--    not invite_id), so revoking never breaks an already-linked parent.
drop function revoke_invite(uuid);

create function revoke_invite(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update invites
  set status = 'revoked'
  where student_id = p_student_id
    and tutor_id = current_tutor_id()
    and status = 'active';

  if not found then
    raise exception 'No active code to revoke.';
  end if;
end;
$$;

drop function regenerate_invite(uuid);

create function regenerate_invite(p_student_id uuid)
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

  -- Revoke whatever's currently active, if anything (regenerate also works
  -- from an already-revoked state, to issue a fresh code after a revoke).
  update invites
  set status = 'revoked'
  where student_id = p_student_id and tutor_id = v_tutor_id and status = 'active';

  return create_invite(p_student_id);
end;
$$;

-- 6. redeem_invite: no longer flips invite status (a reusable code isn't
--    consumed), so the race this previously guarded against — two parents
--    both winning a "is it still open" check on a single-use code — no
--    longer applies; concurrent redemptions of the same active code are
--    supposed to both succeed. That drops the need for an atomic
--    guarded-UPDATE and lets each failure mode get its own clear message
--    (invalid vs. revoked vs. expired) without leaking which tutor/student
--    a code belongs to — the lookup is by code only, un-scoped by tutor,
--    and every error is generic about the code itself, never the student.
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

revoke execute on function create_invite(uuid) from public;
revoke execute on function revoke_invite(uuid) from public;
revoke execute on function regenerate_invite(uuid) from public;
revoke execute on function redeem_invite(text) from public;
grant execute on function create_invite(uuid) to authenticated;
grant execute on function revoke_invite(uuid) to authenticated;
grant execute on function regenerate_invite(uuid) to authenticated;
grant execute on function redeem_invite(text) to authenticated;

-- 7. create_student: inserts the clients row and issues its first code in
--    one transaction, so a student can never exist without one — a
--    partial failure in create_invite (extremely unlikely; it only raises
--    after 5 collision retries) rolls back the student row too, rather
--    than leaving a codeless student behind.
create function create_student(
  p_student_name text,
  p_payer_name text,
  p_payer_email text,
  p_payer_phone text,
  p_rate_type rate_type,
  p_custom_rate_cents integer,
  p_bill_travel boolean,
  p_travel_rate_cents integer,
  p_is_philanthropic boolean,
  p_scheduling_mode text,
  p_notes text
)
returns clients
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
  v_student clients%rowtype;
begin
  if v_tutor_id is null then
    raise exception 'Not a tutor.';
  end if;

  insert into clients (
    tutor_id, student_name, payer_name, payer_email, payer_phone, rate_type,
    custom_rate_cents, bill_travel, travel_rate_cents, is_philanthropic,
    scheduling_mode, notes
  )
  values (
    v_tutor_id, p_student_name, p_payer_name, p_payer_email, p_payer_phone, p_rate_type,
    p_custom_rate_cents, p_bill_travel, p_travel_rate_cents, p_is_philanthropic,
    p_scheduling_mode, p_notes
  )
  returning * into v_student;

  perform create_invite(v_student.id);

  return v_student;
end;
$$;

revoke execute on function create_student(text, text, text, text, rate_type, integer, boolean, integer, boolean, text, text) from public;
grant execute on function create_student(text, text, text, text, rate_type, integer, boolean, integer, boolean, text, text) to authenticated;
