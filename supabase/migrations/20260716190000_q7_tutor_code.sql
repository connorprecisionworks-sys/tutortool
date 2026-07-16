-- Q7: a tutor-level join code, additive to the existing per-student Student
-- Code system (unaffected, still fully working). A parent who joins via
-- the tutor code lands in a lightweight setup: enter their child's name
-- (creating a new, tutor-owned student flagged for review) or pick from
-- the tutor's unclaimed students (ones with no parent linked yet) to link
-- directly. The tutor sees new parent-created students and can confirm
-- them as-is or merge into an existing student if it turns out to be a
-- duplicate of someone already on the roster.

-- Every tutor gets a code automatically, regardless of insert path — unlike
-- Student Codes (issued by create_student(), an RPC every tutor-side
-- insert already goes through), a `tutors` row is created via a plain
-- client insert (see requireTutor() in lib/auth/tutor.ts). A column
-- DEFAULT calling this function (not a BEFORE INSERT trigger) is what
-- guarantees "never a tutor without a code" here — deliberately not a
-- trigger: Supabase's type generator only reads pg_attrdef (column
-- defaults) to decide whether an Insert type can omit a NOT NULL column,
-- not trigger bodies, so a trigger-only approach would make tutor_code
-- wrongly show up as required in every `.from("tutors").insert(...)` call
-- site's generated type even though it's always filled in at runtime.
create function generate_tutor_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- excludes O, 0, I, 1 — matches Student Codes
  v_code text;
  v_attempts integer := 0;
  i integer;
begin
  loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::integer, 1);
    end loop;

    -- A plain existence check, not an insert-and-catch retry loop: this
    -- runs as part of evaluating a DEFAULT expression, before the row (or
    -- its own unique constraint) exists yet to catch a collision against.
    -- 8 chars from a 33-symbol alphabet is ~1.7 trillion combinations, so
    -- a genuine collision here is astronomically unlikely; on the rare
    -- chance two concurrent tutor signups still land on it, the table's
    -- own `unique` constraint (not this function) is the real backstop —
    -- one insert fails with a normal, already-handled unique_violation.
    if not exists (select 1 from tutors where tutor_code = v_code) then
      return v_code;
    end if;

    v_attempts := v_attempts + 1;
    if v_attempts > 20 then
      raise exception 'Could not generate a unique tutor code — try again.';
    end if;
  end loop;
end;
$$;

-- A volatile-default ADD COLUMN (generate_tutor_code() isn't marked
-- immutable/stable, so it's volatile by default) makes Postgres evaluate
-- the default separately FOR EACH EXISTING ROW during this ALTER TABLE,
-- not just once — every current tutor gets its own freshly generated,
-- unique code as part of this single statement, no separate backfill loop
-- needed.
alter table tutors add column tutor_code text unique not null default generate_tutor_code();

-- Flags a student created via tutor-code parent self-signup as awaiting
-- tutor review — distinct from the tutor manually adding a student (which
-- never sets this), so the "new from parent signups" list on the Students
-- page only ever shows students the tutor hasn't actually seen yet.
alter table clients add column pending_parent_review boolean not null default false;

-- Public: only the tutor's display name, to personalize the pre-auth
-- /join?tutor_code=... landing page before the parent has an account —
-- same minimal-public-surface pattern as get_public_tutor_profile (Q3) and
-- get_booking_link_public (Q2).
create function get_tutor_name_for_code(p_code text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select name from tutors where tutor_code = upper(btrim(p_code));
$$;

-- The unclaimed-student roster, unlike the tutor's name, is gated behind
-- an actual parent account (not public) — the code alone shouldn't let
-- anyone enumerate another family's children's names before ever proving
-- they're a signed-in parent acting on that code.
create function get_unclaimed_students_for_tutor_code(p_code text)
returns json
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_tutor_id uuid;
begin
  if not exists (select 1 from users where auth_user_id = auth.uid() and role = 'parent') then
    raise exception 'Not a parent account.';
  end if;

  select id into v_tutor_id from tutors where tutor_code = upper(btrim(p_code));
  if v_tutor_id is null then
    raise exception 'Invalid code. Double-check with your tutor.';
  end if;

  return coalesce(
    (
      select json_agg(json_build_object('id', c.id, 'student_name', c.student_name) order by c.student_name)
      from clients c
      where c.tutor_id = v_tutor_id
        and c.archived = false
        and not exists (select 1 from parent_students ps where ps.student_id = c.id)
    ),
    '[]'::json
  );
end;
$$;

-- redeem_tutor_code: the sole write path for tutor-code parent setup.
-- Exactly one of p_child_name (new student) / p_existing_student_id (pick
-- from the unclaimed roster) — mirrors redeem_invite's locking shape
-- (lock-then-check, not check-then-lock) to close the same class of TOCTOU
-- race that migration's own history already caught once (two parents
-- racing to claim the same unclaimed student).
create function redeem_tutor_code(
  p_code text,
  p_child_name text default null,
  p_existing_student_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_user_id uuid;
  v_parent_name text;
  v_parent_email text;
  v_tutor_id uuid;
  v_student_id uuid;
  v_client clients%rowtype;
  v_code text;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_attempts integer := 0;
  i integer;
begin
  select id, name, email into v_parent_user_id, v_parent_name, v_parent_email
  from users where auth_user_id = auth.uid() and role = 'parent';
  if v_parent_user_id is null then
    raise exception 'Not a parent account.';
  end if;

  select id into v_tutor_id from tutors where tutor_code = upper(btrim(p_code));
  if v_tutor_id is null then
    raise exception 'Invalid code. Double-check with your tutor.';
  end if;

  if (p_child_name is null) = (p_existing_student_id is null) then
    raise exception 'Enter your child''s name, or pick one from the list — not both.';
  end if;

  if p_existing_student_id is not null then
    -- archived = false matches get_unclaimed_students_for_tutor_code's own
    -- listing filter — without it, a student archived between the parent
    -- loading the picker and submitting could still be linked here.
    select * into v_client from clients
    where id = p_existing_student_id and tutor_id = v_tutor_id and archived = false
    for update;
    if v_client.id is null then
      raise exception 'Student not found.';
    end if;
    if exists (select 1 from parent_students where student_id = v_client.id) then
      raise exception 'That student already has a parent linked — ask your tutor to check.';
    end if;
    v_student_id := v_client.id;
  else
    if btrim(p_child_name) = '' then
      raise exception 'Enter your child''s name.';
    end if;

    insert into clients (tutor_id, student_name, rate_type, scheduling_mode, pending_parent_review)
    values (v_tutor_id, btrim(p_child_name), 'standard', 'message', true)
    returning id into v_student_id;

    -- Mirrors create_invite()'s codegen loop, inlined for the same reason
    -- as Q2's confirm_booking_link: create_invite() derives its tutor from
    -- current_tutor_id()/auth.uid(), which resolves to this PARENT's
    -- users row here, not a tutor — "never a student without a code"
    -- still has to hold for a parent-created student.
    loop
      v_code := '';
      for i in 1..7 loop
        v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::integer, 1);
      end loop;
      begin
        insert into invites (tutor_id, student_id, code, status)
        values (v_tutor_id, v_student_id, v_code, 'active');
        exit;
      exception when unique_violation then
        v_attempts := v_attempts + 1;
        if v_attempts > 5 then
          raise exception 'Could not generate a unique invite code — try again.';
        end if;
      end;
    end loop;
  end if;

  insert into parent_students (parent_user_id, student_id, parent_name, parent_email)
  values (v_parent_user_id, v_student_id, v_parent_name, v_parent_email)
  on conflict (parent_user_id, student_id)
  do update set parent_name = excluded.parent_name, parent_email = excluded.parent_email;

  return v_student_id;
end;
$$;

-- confirm_pending_student: tutor accepts a parent-created student as-is.
create function confirm_pending_student(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update clients
  set pending_parent_review = false
  where id = p_student_id and tutor_id = current_tutor_id() and pending_parent_review = true;

  if not found then
    raise exception 'Student not found or not pending review.';
  end if;
end;
$$;

-- merge_pending_student: tutor decides a parent-created student is a
-- duplicate of someone already on the roster — re-points the parent link
-- to the target student and discards the auto-created duplicate. Only
-- ever allowed on a still-pending, still-history-free student (mirrors
-- delete_student's guard) since a merge that had to migrate real
-- sessions/invoices off the duplicate first would be a much bigger,
-- separate feature.
create function merge_pending_student(p_pending_student_id uuid, p_target_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
  v_pending clients%rowtype;
begin
  if v_tutor_id is null then
    raise exception 'Not authorized.';
  end if;

  if p_pending_student_id = p_target_student_id then
    raise exception 'Pick a different student to merge into.';
  end if;

  select * into v_pending from clients
  where id = p_pending_student_id and tutor_id = v_tutor_id and pending_parent_review = true
  for update;
  if v_pending.id is null then
    raise exception 'Student not found or not pending review.';
  end if;

  if not exists (
    select 1 from clients where id = p_target_student_id and tutor_id = v_tutor_id and archived = false
  ) then
    raise exception 'Target student not found.';
  end if;

  if exists (select 1 from sessions where client_id = p_pending_student_id)
     or exists (select 1 from invoices where client_id = p_pending_student_id)
  then
    raise exception 'This student already has sessions or invoices — too late to merge, confirm it instead.';
  end if;

  -- ON CONFLICT isn't valid on UPDATE — a parent who happens to already be
  -- linked to the target student (e.g. they picked "add new" by mistake
  -- when they could have picked this same target from the unclaimed list)
  -- would violate parent_students' (parent_user_id, student_id) unique
  -- constraint on the UPDATE below. Drop that parent's now-redundant link
  -- to the pending row first so the UPDATE never collides.
  delete from parent_students
  where student_id = p_pending_student_id
    and parent_user_id in (select parent_user_id from parent_students where student_id = p_target_student_id);

  update parent_students set student_id = p_target_student_id
  where student_id = p_pending_student_id;

  -- delete_student() re-derives its own tutor auth and would otherwise
  -- refuse a second ownership check here for no benefit — this function
  -- has already locked and verified the row above, so a direct delete
  -- (invites/resources cascade via their own FKs) is simpler than a
  -- redundant RPC-to-RPC call.
  delete from clients where id = p_pending_student_id;
end;
$$;

revoke execute on function get_tutor_name_for_code(text) from public;
revoke execute on function get_unclaimed_students_for_tutor_code(text) from public;
revoke execute on function redeem_tutor_code(text, text, uuid) from public;
revoke execute on function confirm_pending_student(uuid) from public;
revoke execute on function merge_pending_student(uuid, uuid) from public;

grant execute on function get_tutor_name_for_code(text) to anon, authenticated;
grant execute on function get_unclaimed_students_for_tutor_code(text) to authenticated;
grant execute on function redeem_tutor_code(text, text, uuid) to authenticated;
grant execute on function confirm_pending_student(uuid) to authenticated;
grant execute on function merge_pending_student(uuid, uuid) to authenticated;
